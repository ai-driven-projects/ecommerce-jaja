// Handlers of the DbMigration custom resource (Provider framework of the CDK).
// Plain JavaScript on the Node.js runtime of Lambda, which already ships the
// AWS SDK v3: no bundling.
//
// onEvent: on Create/Update runs the migration task (image of the backend,
// command `migrate`) once; on Delete does nothing.
// isComplete: waits for the task to stop and fails when the `migrate`
// container did not exit with 0, pointing to its log.
const { ECSClient, RunTaskCommand, DescribeTasksCommand } = require('@aws-sdk/client-ecs');

const ecs = new ECSClient({});

exports.onEvent = async (event) => {
  if (event.RequestType === 'Delete') {
    return { PhysicalResourceId: event.PhysicalResourceId };
  }

  const props = event.ResourceProperties;
  const result = await ecs.send(
    new RunTaskCommand({
      cluster: props.ClusterArn,
      taskDefinition: props.TaskDefinitionArn,
      launchType: 'FARGATE',
      count: 1,
      startedBy: 'db-migration',
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: props.SubnetIds,
          securityGroups: props.SecurityGroupIds,
          assignPublicIp: 'DISABLED',
        },
      },
    }),
  );

  const task = result.tasks && result.tasks[0];
  if (!task) {
    const reasons = (result.failures || []).map((failure) => `${failure.arn}: ${failure.reason}`);
    throw new Error(`A task de migração não iniciou: ${reasons.join('; ') || 'sem detalhes'}`);
  }

  console.log(`Migration task started: ${task.taskArn}`);
  return {
    PhysicalResourceId: event.PhysicalResourceId || `db-migration-${props.ClusterArn.split('/').pop()}`,
    Data: { TaskArn: task.taskArn },
  };
};

exports.isComplete = async (event) => {
  if (event.RequestType === 'Delete') return { IsComplete: true };

  const props = event.ResourceProperties;
  const taskArn = event.Data && event.Data.TaskArn;
  const result = await ecs.send(new DescribeTasksCommand({ cluster: props.ClusterArn, tasks: [taskArn] }));
  const task = result.tasks && result.tasks[0];
  if (!task) throw new Error(`Task de migração não encontrada: ${taskArn}`);
  if (task.lastStatus !== 'STOPPED') return { IsComplete: false };

  const container = (task.containers || []).find((item) => item.name === props.ContainerName);
  const exitCode = container ? container.exitCode : undefined;
  if (exitCode === 0) return { IsComplete: true };

  const taskId = taskArn.split('/').pop();
  const logStream = `${props.LogStreamPrefix}/${props.ContainerName}/${taskId}`;
  throw new Error(
    `A migração falhou (exit ${exitCode === undefined ? 'desconhecido' : exitCode}` +
      `${task.stoppedReason ? `, ${task.stoppedReason}` : ''}). ` +
      `Log: grupo ${props.LogGroupName}, stream ${logStream}`,
  );
};
