using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskNest.Dtos;
using TaskNest.Extensions;
using TaskNest.Services;

namespace TaskNest.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var result = await _authService.RegisterAsync(request.Name, request.Email, request.Password);
        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new { message = result.Error });
        }

        return StatusCode(201, new AuthResponse
        {
            Token = result.Token!,
            User = UserDto.FromEntity(result.User!)
        });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var result = await _authService.LoginAsync(request.Email, request.Password);
        if (!result.Success)
        {
            return StatusCode(result.StatusCode, new { message = result.Error });
        }

        return Ok(new AuthResponse
        {
            Token = result.Token!,
            User = UserDto.FromEntity(result.User!)
        });
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var user = await _authService.GetUserAsync(User.GetUserId());
        return user is null ? Unauthorized() : Ok(UserDto.FromEntity(user));
    }
}
