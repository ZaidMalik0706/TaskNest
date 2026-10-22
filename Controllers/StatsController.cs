using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskNest.Dtos;
using TaskNest.Extensions;
using TaskNest.Services;

namespace TaskNest.Controllers;

[ApiController]
[Authorize]
[Route("api/stats")]
public class StatsController : ControllerBase
{
    private readonly IStatsService _statsService;

    public StatsController(IStatsService statsService)
    {
        _statsService = statsService;
    }

    [HttpGet]
    public async Task<ActionResult<StatsResponse>> GetStats()
    {
        var stats = await _statsService.GetStatsAsync(User.GetUserId());
        return Ok(stats);
    }
}
