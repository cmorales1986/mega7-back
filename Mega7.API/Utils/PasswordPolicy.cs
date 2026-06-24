using System.Text.RegularExpressions;

namespace Mega7.API.Utils
{
    public static class PasswordPolicy
    {
        public static (bool ok, string? error) Validate(string password)
        {
            if (string.IsNullOrWhiteSpace(password))
                return (false, "La contraseña es requerida.");

            if (password.Length < 8)
                return (false, "La contraseña debe tener mínimo 8 caracteres.");

            if (!Regex.IsMatch(password, "[A-Z]"))
                return (false, "La contraseña debe contener al menos 1 mayúscula.");

            if (!Regex.IsMatch(password, "[a-z]"))
                return (false, "La contraseña debe contener al menos 1 minúscula.");

            if (!Regex.IsMatch(password, "[0-9]"))
                return (false, "La contraseña debe contener al menos 1 número.");

            return (true, null);
        }
    }
}
