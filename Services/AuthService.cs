using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using TaskNest.Data;
using TaskNest.Models;

namespace TaskNest.Services;

public class AuthService : IAuthService
{
    private readonly AppDbContext _db;
    private readonly IPasswordHasher<User> _passwordHasher;
    private readonly IConfiguration _configuration;

    public AuthService(AppDbContext db, IPasswordHasher<User> passwordHasher, IConfiguration configuration)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    public async Task<AuthResult> RegisterAsync(string name, string email, string password)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == normalizedEmail))
        {
            return new AuthResult(false, null, null, "An account with this email already exists.", 409);
        }

        var user = new User
        {
            Name = name.Trim(),
            Email = normalizedEmail,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, password);

        _db.Users.Add(user);

        try
        {
            await _db.SaveChangesAsync();
        }
        catch (DbUpdateException)
        {
            // Handles two registrations racing for the same unique email.
            return new AuthResult(false, null, null, "An account with this email already exists.", 409);
        }

        return new AuthResult(true, user, CreateToken(user), null, 201);
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == normalizedEmail);

        if (user is null)
        {
            return new AuthResult(false, null, null, "Invalid email or password.", 401);
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        if (verification == PasswordVerificationResult.Failed)
        {
            return new AuthResult(false, null, null, "Invalid email or password.", 401);
        }

        return new AuthResult(true, user, CreateToken(user), null, 200);
    }

    public Task<User?> GetUserAsync(int userId)
    {
        return _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId);
    }

    private string CreateToken(User user)
    {
        var key = _configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("Jwt:Key is not configured.");
        var issuer = _configuration["Jwt:Issuer"] ?? "TaskNest";
        var audience = _configuration["Jwt:Audience"] ?? "TaskNest";

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email),
            new Claim("name", user.Name),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer,
            audience,
            claims,
            notBefore: DateTime.UtcNow,
            expires: DateTime.UtcNow.AddDays(1),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
