using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskNest.Dtos;
using TaskNest.Extensions;
using TaskNest.Services;

namespace TaskNest.Controllers;

[ApiController]
[Authorize]
[Route("api/focus")]
public class FocusController : ControllerBase
{
    private readonly IFocusService _focusService;

    public FocusController(IFocusService focusService)
    {
        _focusService = focusService;
    }

    [HttpPost]
    public async Task<IActionResult> LogSession(FocusRequest request)
    {
        var session = await _focusService.LogAsync(
            User.GetUserId(), request.TaskId, request.Minutes, request.StartedAt);

        if (session is null)
        {
            return NotFound();
        }

        return StatusCode(201, new
        {
            session.Id,
            session.Minutes,
            session.StartedAt,
            session.TaskItemId
        });
    }
}
