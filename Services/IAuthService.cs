using TaskNest.Models;

namespace TaskNest.Services;

public record AuthResult(
    bool Success,
    User? User,
    string? Token,
    string? Error,
    int StatusCode);

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string name, string email, string password);
    Task<AuthResult> LoginAsync(string email, string password);
    Task<User?> GetUserAsync(int userId);
}
