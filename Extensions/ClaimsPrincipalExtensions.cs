using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace TaskNest.Extensions;

public static class ClaimsPrincipalExtensions
{
    /// <summary>Reads the user id from the "sub" claim issued in the JWT.</summary>
    public static int GetUserId(this ClaimsPrincipal user)
    {
        var value = user.FindFirstValue(JwtRegisteredClaimNames.Sub)
            ?? user.FindFirstValue(ClaimTypes.NameIdentifier);

        return int.TryParse(value, out var id) ? id : 0;
    }
}
