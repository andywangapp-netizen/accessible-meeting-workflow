"""Test bundle generation and stable-ID updates without credentials."""
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location('drive_sync', Path(__file__).resolve().parents[1] / 'scripts/sync_transcripts_to_drive.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class Response:
    ok = True
    def __init__(self, data):
        self.data = data
    def json(self):
        return self.data


class Drive:
    def __init__(self, checksum='old', corrupt=False, mime='application/json'):
        self.checksum, self.corrupt, self.mime = checksum, corrupt, mime
        self.writes = []
    def request(self, method, url, **kwargs):
        assert url.endswith('/stable-id')
        if method == 'PATCH':
            self.writes.append(kwargs['data'])
            if not self.corrupt:
                self.checksum = hashlib.md5(kwargs['data']).hexdigest()
        else:
            assert method == 'GET'
        return Response({'id': 'stable-id', 'mimeType': self.mime, 'md5Checksum': self.checksum})


def fixture(tmp_path, name='sample'):
    obj = {'id': name, 'title': 'Test', 'participants': ['Rowan'], 'transcript': 'Rowan: I will send the agenda. — Friday'}
    (tmp_path / (name + '.json')).write_text(json.dumps(obj))
    return obj


def test_bundle_preserves_all_objects_in_stable_order(tmp_path):
    second = fixture(tmp_path, 'b')
    first = fixture(tmp_path, 'a')
    bundle = sync.build_bundle(tmp_path)
    assert json.loads(bundle)['transcripts'] == [first, second]
    assert sync.build_bundle(tmp_path) == bundle


def test_changed_bundle_updates_once_and_preserves_id(tmp_path):
    fixture(tmp_path)
    drive = Drive()
    assert sync.sync(drive, tmp_path, 'stable-id') == 'updated'
    assert drive.writes == [sync.build_bundle(tmp_path)]
    assert sync.sync(drive, tmp_path, 'stable-id') == 'unchanged'
    assert len(drive.writes) == 1


def test_dry_run_never_writes(tmp_path):
    fixture(tmp_path)
    drive = Drive()
    assert sync.sync(drive, tmp_path, 'stable-id', dry_run=True) == 'updated'
    assert drive.writes == []


def test_additions_and_deletions_change_bundle(tmp_path):
    fixture(tmp_path)
    initial = sync.build_bundle(tmp_path)
    fixture(tmp_path, 'second')
    assert initial != sync.build_bundle(tmp_path)
    (tmp_path / 'second.json').unlink()
    assert initial == sync.build_bundle(tmp_path)


def test_invalid_and_empty_input_stop_before_writes(tmp_path):
    drive = Drive()
    with pytest.raises(ValueError):
        sync.sync(drive, tmp_path, 'stable-id')
    (tmp_path / 'sample.json').write_text('{')
    with pytest.raises(ValueError):
        sync.sync(drive, tmp_path, 'stable-id')
    assert drive.writes == []


def test_wrong_target_type_and_failed_verification(tmp_path):
    fixture(tmp_path)
    with pytest.raises(RuntimeError, match='JSON file'):
        sync.sync(Drive(mime='application/vnd.google-apps.folder'), tmp_path, 'stable-id')
    with pytest.raises(RuntimeError, match='verification failed'):
        sync.sync(Drive(corrupt=True), tmp_path, 'stable-id')
