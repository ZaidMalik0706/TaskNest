using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaskNest.Dtos;
using TaskNest.Extensions;
using TaskNest.Models;
using TaskNest.Services;

namespace TaskNest.Controllers;

[ApiController]
[Authorize]
[Route("api/tasks")]
public class TasksController : ControllerBase
{
    private readonly ITaskService _taskService;

    public TasksController(ITaskService taskService)
    {
        _taskService = taskService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<TaskResponse>>> GetTasks(
        [FromQuery] string? status, [FromQuery] string? category, [FromQuery] string? q)
    {
        if (!string.IsNullOrWhiteSpace(status) &&
            !status.Equals("active", StringComparison.OrdinalIgnoreCase) &&
            !status.Equals("done", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new { message = "status must be 'active' or 'done'." });
        }

        var tasks = await _taskService.GetTasksAsync(User.GetUserId(), status, category, q);
        return Ok(tasks.Select(TaskResponse.FromEntity));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<TaskResponse>> GetTask(Guid id)
    {
        var task = await _taskService.GetByIdAsync(User.GetUserId(), id);
        return task is null ? NotFound() : Ok(TaskResponse.FromEntity(task));
    }

    [HttpPost]
    public async Task<ActionResult<TaskResponse>> CreateTask(TaskUpsertRequest request)
    {
        var result = await _taskService.CreateOrUpdateAsync(User.GetUserId(), request);

        if (result.Conflict)
        {
            return Conflict(new { message = "This task id is already in use." });
        }

        var response = TaskResponse.FromEntity(result.Task!);
        return result.Created
            ? CreatedAtAction(nameof(GetTask), new { id = response.Id }, response)
            : Ok(response);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateTask(Guid id, TaskUpsertRequest request)
    {
        if (request.Id != Guid.Empty && request.Id != id)
        {
            return BadRequest(new { message = "Route id does not match the body id." });
        }

        var updated = await _taskService.UpdateAsync(User.GetUserId(), id, request);
        return updated ? NoContent() : NotFound();
    }

    [HttpPatch("{id:guid}/toggle")]
    public async Task<IActionResult> ToggleTask(Guid id)
    {
        var updated = await _taskService.ToggleAsync(User.GetUserId(), id);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteTask(Guid id)
    {
        var deleted = await _taskService.DeleteAsync(User.GetUserId(), id);
        return deleted ? NoContent() : NotFound();
    }

    [HttpPost("{id:guid}/subtasks")]
    public async Task<IActionResult> AddSubtask(Guid id, SubtaskRequest request)
    {
        var subtask = await _taskService.AddSubtaskAsync(User.GetUserId(), id, request);
        return subtask is null
            ? NotFound()
            : StatusCode(201, SubtaskDto.FromEntity(subtask));
    }

    [HttpPatch("{id:guid}/subtasks/{subtaskId:guid}")]
    public async Task<IActionResult> UpdateSubtask(Guid id, Guid subtaskId, SubtaskUpdateRequest request)
    {
        if (request.Title is null && request.IsDone is null)
        {
            return BadRequest(new { message = "Provide a title or isDone value." });
        }

        var updated = await _taskService.UpdateSubtaskAsync(
            User.GetUserId(), id, subtaskId, request);
        return updated ? NoContent() : NotFound();
    }

    [HttpDelete("{id:guid}/subtasks/{subtaskId:guid}")]
    public async Task<IActionResult> DeleteSubtask(Guid id, Guid subtaskId)
    {
        var deleted = await _taskService.DeleteSubtaskAsync(User.GetUserId(), id, subtaskId);
        return deleted ? NoContent() : NotFound();
    }
}
