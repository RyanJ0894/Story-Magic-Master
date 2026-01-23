import { describe, it, expect } from 'vitest';
import {
  Job,
  JobStatus,
  JobType,
  JobProgress,
  QueuePosition,
  QueueStats,
  jobRowToJob,
  formatDuration,
  formatWaitTime,
} from '@/lib/queue/types';

describe('Queue Types', () => {
  describe('JobStatus', () => {
    it('should have all valid statuses', () => {
      const statuses: JobStatus[] = ['queued', 'processing', 'completed', 'failed'];
      expect(statuses).toHaveLength(4);
    });
  });

  describe('JobType', () => {
    it('should have all valid job types', () => {
      const types: JobType[] = [
        'audio_generation',
        'pdf_extract',
        'ocr_extract',
        'score_generation',
        'suggestion_generation',
      ];
      expect(types).toHaveLength(5);
    });
  });

  describe('formatDuration', () => {
    it('should format milliseconds correctly', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(999)).toBe('999ms');
    });

    it('should format seconds correctly', () => {
      expect(formatDuration(1000)).toBe('1.0s');
      expect(formatDuration(5500)).toBe('5.5s');
      expect(formatDuration(59999)).toBe('60.0s');
    });

    it('should format minutes correctly', () => {
      expect(formatDuration(60000)).toBe('1.0m');
      expect(formatDuration(120000)).toBe('2.0m');
      expect(formatDuration(90000)).toBe('1.5m');
    });
  });

  describe('formatWaitTime', () => {
    it('should format seconds correctly', () => {
      expect(formatWaitTime(30)).toBe('30s');
      expect(formatWaitTime(59)).toBe('59s');
    });

    it('should format minutes correctly', () => {
      expect(formatWaitTime(60)).toBe('1m');
      expect(formatWaitTime(120)).toBe('2m');
      expect(formatWaitTime(300)).toBe('5m');
    });

    it('should format hours correctly', () => {
      expect(formatWaitTime(3600)).toBe('1.0h');
      expect(formatWaitTime(7200)).toBe('2.0h');
      expect(formatWaitTime(5400)).toBe('1.5h');
    });
  });

  describe('jobRowToJob', () => {
    it('should convert database row to Job object', () => {
      const row = {
        id: 'job-123',
        project_id: 'project-456',
        user_id: 'user-789',
        status: 'processing',
        job_type: 'audio_generation',
        priority: 0,
        progress: { step: 'mixing', percent: 75 },
        result: null,
        error: null,
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        worker_id: 'worker-1',
        processing_lock: 'lock-abc',
        lock_expires_at: '2026-01-22T12:00:00Z',
        queued_at: '2026-01-22T11:50:00Z',
        started_at: '2026-01-22T11:55:00Z',
        completed_at: null,
        created_at: '2026-01-22T11:50:00Z',
        estimated_duration_ms: 120000,
        actual_duration_ms: null,
      };

      const job = jobRowToJob(row);

      expect(job.id).toBe('job-123');
      expect(job.projectId).toBe('project-456');
      expect(job.userId).toBe('user-789');
      expect(job.status).toBe('processing');
      expect(job.jobType).toBe('audio_generation');
      expect(job.priority).toBe(0);
      expect(job.progress.step).toBe('mixing');
      expect(job.progress.percent).toBe(75);
      expect(job.retryCount).toBe(0);
      expect(job.maxRetries).toBe(3);
      expect(job.workerId).toBe('worker-1');
      expect(job.queuedAt).toBeInstanceOf(Date);
      expect(job.startedAt).toBeInstanceOf(Date);
      expect(job.completedAt).toBeNull();
    });

    it('should handle null dates correctly', () => {
      const row = {
        id: 'job-123',
        project_id: 'project-456',
        user_id: 'user-789',
        status: 'queued',
        job_type: 'audio_generation',
        priority: 0,
        progress: { step: 'queued', percent: 0 },
        result: null,
        error: null,
        retry_count: 0,
        max_retries: 3,
        last_error: null,
        worker_id: null,
        processing_lock: null,
        lock_expires_at: null,
        queued_at: null,
        started_at: null,
        completed_at: null,
        created_at: '2026-01-22T11:50:00Z',
        estimated_duration_ms: null,
        actual_duration_ms: null,
      };

      const job = jobRowToJob(row);

      expect(job.queuedAt).toBeNull();
      expect(job.startedAt).toBeNull();
      expect(job.completedAt).toBeNull();
      expect(job.workerId).toBeNull();
    });
  });

  describe('Job interface', () => {
    it('should create valid job objects', () => {
      const job: Job = {
        id: 'job-1',
        projectId: 'project-1',
        userId: 'user-1',
        status: 'queued',
        jobType: 'audio_generation',
        priority: 0,
        progress: { step: 'queued', percent: 0 },
        result: null,
        error: null,
        retryCount: 0,
        maxRetries: 3,
        lastError: null,
        workerId: null,
        queuedAt: new Date(),
        startedAt: null,
        completedAt: null,
        createdAt: new Date(),
        estimatedDurationMs: 120000,
        actualDurationMs: null,
      };

      expect(job.status).toBe('queued');
      expect(job.priority).toBe(0);
      expect(job.maxRetries).toBe(3);
    });
  });

  describe('QueuePosition interface', () => {
    it('should create valid queue position objects', () => {
      const position: QueuePosition = {
        position: 3,
        estimatedWaitSeconds: 180,
        jobsAhead: 2,
      };

      expect(position.position).toBe(3);
      expect(position.jobsAhead).toBe(2);
      expect(position.estimatedWaitSeconds).toBe(180);
    });
  });

  describe('QueueStats interface', () => {
    it('should create valid queue stats objects', () => {
      const stats: QueueStats = {
        jobType: 'audio_generation',
        queuedCount: 5,
        processingCount: 2,
        completed24h: 100,
        failed24h: 3,
        avgDurationMs: 90000,
        oldestQueuedAt: new Date(),
        staleLocks: 0,
      };

      expect(stats.queuedCount).toBe(5);
      expect(stats.processingCount).toBe(2);
      expect(stats.completed24h).toBe(100);
      expect(stats.failed24h).toBe(3);
    });
  });

  describe('JobProgress interface', () => {
    it('should create valid progress objects', () => {
      const progress: JobProgress = {
        step: 'generating_audio',
        percent: 45,
        details: 'Processing scene 3 of 10',
        updatedAt: new Date().toISOString(),
      };

      expect(progress.step).toBe('generating_audio');
      expect(progress.percent).toBe(45);
      expect(progress.details).toBeDefined();
    });

    it('should support retry information', () => {
      const progress: JobProgress = {
        step: 'retrying',
        percent: 0,
        error: 'Network timeout',
        retryAttempt: 2,
      };

      expect(progress.retryAttempt).toBe(2);
      expect(progress.error).toBe('Network timeout');
    });
  });
});

describe('Queue Priority', () => {
  it('should sort jobs by priority DESC, then queued_at ASC', () => {
    const jobs = [
      { priority: 0, queuedAt: new Date('2026-01-22T12:00:00Z') },
      { priority: 10, queuedAt: new Date('2026-01-22T12:05:00Z') },
      { priority: 0, queuedAt: new Date('2026-01-22T11:55:00Z') },
      { priority: 5, queuedAt: new Date('2026-01-22T12:00:00Z') },
    ];

    const sorted = [...jobs].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.queuedAt.getTime() - b.queuedAt.getTime();
    });

    expect(sorted[0].priority).toBe(10); // Highest priority first
    expect(sorted[1].priority).toBe(5);
    expect(sorted[2].priority).toBe(0);
    expect(sorted[2].queuedAt.getTime()).toBeLessThan(sorted[3].queuedAt.getTime()); // FIFO for same priority
  });
});
