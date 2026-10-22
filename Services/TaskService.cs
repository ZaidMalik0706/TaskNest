using Microsoft.EntityFrameworkCore;
using TaskNest.Data;
using TaskNest.Dtos;
using TaskNest.Models;

namespace TaskNest.Services;

public class TaskService : ITaskService
{
    private readonly AppDbContext _db;

    public TaskService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<TaskItem>> GetTasksAsync(int userId, string? status, string? category, string? query)
    {
        // Every query starts with the user filter: users can never see each other's tasks.
        var tasks = _db.Tasks
            .AsNoTracking()
            .Where(t => t.UserId == userId)
            .Include(t => t.Subtasks)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            var isDone = status.Equals("done", StringComparison.OrdinalIgnoreCase);
            tasks = tasks.Where(t => t.IsDone == isDone);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            var normalized = category.Trim().ToLower();
            tasks = tasks.Where(t => t.Category != null && t.Category.ToLower() == normalized);
        }

        if (!string.IsNullOrWhiteSpace(query))
        {
            var term = query.Trim();
            tasks = tasks.Where(t =>
                EF.Functions.Like(t.Title, $"%{term}%") ||
                (t.Notes != null && EF.Functions.Like(t.Notes, $"%{term}%")));
        }

        return await tasks
            .OrderBy(t => t.IsDone)
            .ThenBy(t => t.DueDate == null)
            .ThenBy(t => t.DueDate)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();
    }

    public Task<TaskItem?> GetByIdAsync(int userId, Guid id)
    {
        return _db.Tasks
            .AsNoTracking()
            .Include(t => t.Subtasks)
            .FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
    }

    public async Task<(TaskItem? Task, bool Created, bool Conflict)> CreateOrUpdateAsync(
        int userId, TaskUpsertRequest request)
    {
        var id = request.Id == Guid.Empty ? Guid.NewGuid() : request.Id;
        var existing = await _db.Tasks
            .Include(t => t.Subtasks)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (existing is not null && existing.UserId != userId)
        {
            // Never expose or modify another user's task.
            return (null, false, true);
        }

        if (existing is null)
        {
            var task = new TaskItem
            {
                Id = id,
                UserId = userId,
                CreatedAt = DateTime.UtcNow
            };
            ApplyChanges(task, request);
            task.UpdatedAt = task.CreatedAt;

            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();
            return (task, true, false);
        }

        // POST with an id that already belongs to this user is treated as an update.
        ApplyChanges(existing, request);
        existing.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return (existing, false, false);
    }

    public async Task<bool> UpdateAsync(int userId, Guid id, TaskUpsertRequest request)
    {
        var existing = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (existing is null)
        {
            return false;
        }

        ApplyChanges(existing, request);
        existing.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ToggleAsync(int userId, Guid id)
    {
        var existing = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (existing is null)
        {
            return false;
        }

        existing.IsDone = !existing.IsDone;
        existing.CompletedAt = existing.IsDone ? DateTime.UtcNow : null;
        existing.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int userId, Guid id)
    {
        var existing = await _db.Tasks.FirstOrDefaultAsync(t => t.Id == id && t.UserId == userId);
        if (existing is null)
        {
            return false;
        }

        _db.Tasks.Remove(existing);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<Subtask?> AddSubtaskAsync(int userId, Guid taskId, SubtaskRequest request)
    {
        var taskExists = await _db.Tasks.AnyAsync(t => t.Id == taskId && t.UserId == userId);
        if (!taskExists)
        {
            return null;
        }

        var id = request.Id ?? Guid.NewGuid();
        var existing = await _db.Subtasks.FirstOrDefaultAsync(s => s.Id == id);

        if (existing is not null)
        {
            // Idempotent create: offline replays can safely send the same subtask twice.
            if (existing.TaskItemId != taskId)
            {
                return null;
            }

            existing.Title = request.Title.Trim();
            await _db.SaveChangesAsync();
            return existing;
        }

        var subtask = new Subtask
        {
            Id = id,
            TaskItemId = taskId,
            Title = request.Title.Trim()
        };

        _db.Subtasks.Add(subtask);
        await _db.SaveChangesAsync();
        return subtask;
    }

    public async Task<bool> UpdateSubtaskAsync(
        int userId, Guid taskId, Guid subtaskId, SubtaskUpdateRequest request)
    {
        var taskExists = await _db.Tasks.AnyAsync(t => t.Id == taskId && t.UserId == userId);
        if (!taskExists)
        {
            return false;
        }

        var subtask = await _db.Subtasks
            .FirstOrDefaultAsync(s => s.Id == subtaskId && s.TaskItemId == taskId);
        if (subtask is null)
        {
            return false;
        }

        if (request.Title is not null)
        {
            subtask.Title = request.Title.Trim();
        }

        if (request.IsDone.HasValue)
        {
            subtask.IsDone = request.IsDone.Value;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteSubtaskAsync(int userId, Guid taskId, Guid subtaskId)
    {
        var taskExists = await _db.Tasks.AnyAsync(t => t.Id == taskId && t.UserId == userId);
        if (!taskExists)
        {
            return false;
        }

        var subtask = await _db.Subtasks
            .FirstOrDefaultAsync(s => s.Id == subtaskId && s.TaskItemId == taskId);
        if (subtask is null)
        {
            return false;
        }

        _db.Subtasks.Remove(subtask);
        await _db.SaveChangesAsync();
        return true;
    }

    private static void ApplyChanges(TaskItem task, TaskUpsertRequest request)
    {
        task.Title = request.Title.Trim();
        task.Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim();
        task.Priority = request.Priority;
        task.Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim();
        task.DueDate = request.DueDate;

        if (request.IsDone && !task.IsDone)
        {
            task.CompletedAt = DateTime.UtcNow;
        }
        else if (!request.IsDone)
        {
            task.CompletedAt = null;
        }

        task.IsDone = request.IsDone;
    }
}
