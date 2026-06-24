using Blazored.LocalStorage;

namespace Mega7.WebA.Services
{
    public class SecureLocalStorage
    {
        private readonly ILocalStorageService _storage;

        public SecureLocalStorage(ILocalStorageService storage)
        {
            _storage = storage;
        }

        public ValueTask SetAsync(string key, string value)
            => _storage.SetItemAsync(key, value);

        public ValueTask<string?> GetAsync(string key)
            => _storage.GetItemAsync<string>(key);

        public ValueTask RemoveAsync(string key)
            => _storage.RemoveItemAsync(key);
    }
}
