from mine_backend.core.utils import get_nested_claim, get_claim


class TestGetNestedClaim:
    def test_single_key(self):
        data = {'foo': 'bar'}
        assert get_nested_claim(data, 'foo') == 'bar'

    def test_multi_level_dot_path(self):
        data = {'a': {'b': {'c': 'value'}}}
        assert get_nested_claim(data, 'a.b.c') == 'value'

    def test_missing_key_returns_none(self):
        data = {'foo': 'bar'}
        assert get_nested_claim(data, 'missing') is None

    def test_non_dict_intermediate_returns_none(self):
        data = {'a': 'not-a-dict'}
        assert get_nested_claim(data, 'a.b') is None

    def test_two_level_path(self):
        data = {'realm_access': {'roles': ['admin']}}
        assert get_nested_claim(data, 'realm_access.roles') == ['admin']

    def test_empty_nested_value(self):
        data = {'a': {'b': None}}
        assert get_nested_claim(data, 'a.b') is None


class TestGetClaim:
    def test_single_key(self):
        data = {'policy': 'admin'}
        result = get_claim(data, 'policy')
        assert result == {'policy': 'admin'}

    def test_two_level_path(self):
        data = {'realm_access': {'roles': ['admin']}}
        result = get_claim(data, 'realm_access.roles')
        assert result == {'realm_access': {'roles': ['admin']}}

    def test_missing_path_has_none_leaf(self):
        data = {}
        result = get_claim(data, 'a.b')
        assert result == {'a': {'b': None}}

    def test_missing_single_key_has_none_value(self):
        data = {}
        result = get_claim(data, 'missing')
        assert result == {'missing': None}
