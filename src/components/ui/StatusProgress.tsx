import Progress from './Progress';
import { getStageByProgress, computeProgressFromTasks } from '../../utils/projectUtils';
import type { Task } from '../../data/db';

interface StatusProgressProps {
  status: string;
  tasks?: Task[];
  size?: 'sm' | 'md' | 'lg';
  progress?: number;
}

export default function StatusProgress({ status, tasks = [], size = 'sm', progress }: StatusProgressProps) {
  const computedProgress = progress !== undefined ? progress : computeProgressFromTasks(tasks, status);
  const stage = getStageByProgress(computedProgress);
  const color = computedProgress === 100 ? 'success' : computedProgress > 50 ? 'primary' : 'warning';

  return (
    <div className="flex flex-col gap-1.5 min-w-0 w-full">
      <Progress value={computedProgress} size={size} color={color} showLabel stageLabel={stage.label} />
    </div>
  );
}
