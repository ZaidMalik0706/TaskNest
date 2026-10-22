using TaskNest.Dtos;
using TaskNest.Models;

namespace TaskNest.Services;

public interface ITaskService
{
    Task<IReadOnlyList<TaskItem>> GetTasksAsync(int userId, string? status, string? category, string? query);
    Task<TaskItem?> GetByIdAsync(int userId, Guid id);
    Task<(TaskItem? Task, bool Created, bool Conflict)> CreateOrUpdateAsync(int userId, TaskUpsertRequest request);
    Task<bool> UpdateAsync(int userId, Guid id, TaskUpsertRequest request);
    Task<bool> ToggleAsync(int userId, Guid id);
    Task<bool> DeleteAsync(int userId, Guid id);

    Task<Subtask?> AddSubtaskAsync(int userId, Guid taskId, SubtaskRequest request);
    Task<bool> UpdateSubtaskAsync(int userId, Guid taskId, Guid subtaskId, SubtaskUpdateRequest request);
    Task<bool> DeleteSubtaskAsync(int userId, Guid taskId, Guid subtaskId);
}
