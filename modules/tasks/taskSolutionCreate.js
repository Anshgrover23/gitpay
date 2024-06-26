const Promise = require('bluebird')
const models = require('../../models')
const taskSolutionFetchData = require('./taskSolutionFetchData')
const assignExist = require('../assigns').assignExists
const transferBuilds = require('../transfers/transferBuilds')
const taskUpdate = require('../tasks/taskUpdate')

module.exports = Promise.method(async function taskSolutionCreate (taskSolutionParams) {
  const pullRequestURLSplitted = taskSolutionParams.pullRequestURL.split('/')
  const params = {
    pullRequestId: pullRequestURLSplitted[6],
    userId: taskSolutionParams.userId,
    repositoryName: pullRequestURLSplitted[4],
    owner: pullRequestURLSplitted[3],
    taskId: taskSolutionParams.taskId
  }

  const fetchTaskSolutionData = await taskSolutionFetchData(params)
  const task = await models.Task.findOne({
    where: { id: taskSolutionParams.taskId }
  })

  if (fetchTaskSolutionData.isAuthorOfPR && fetchTaskSolutionData.isConnectedToGitHub && fetchTaskSolutionData.isIssueClosed && fetchTaskSolutionData.isPRMerged && fetchTaskSolutionData.hasIssueReference) {
    if (!task.dataValues.paid && !task.dataValues.transfer_id) {
      const existingAssignment = await assignExist({ userId: taskSolutionParams.userId, taskId: taskSolutionParams.taskId })

      if (!existingAssignment) {
        const assign = await task.createAssign({ userId: taskSolutionParams.userId })
        if (!assign) {
          throw new Error('COULD_NOT_CREATE_ASSIGN')
        }
        const taskUpdateAssign = await taskUpdate({ id: taskSolutionParams.taskId, assigned: assign.dataValues.id })
        if (!taskUpdateAssign) {
          throw new Error('COULD_NOT_UPDATE_TASK')
        }
      }
    }

    return models.TaskSolution.create(taskSolutionParams).then(async data => {
      const transferSend = await transferBuilds({ taskId: task.dataValues.id, userId: task.dataValues.userId })
      if (transferSend.error) {
        throw new Error('transferSend.error')
      }
      return data.dataValues
    }).catch(err => {
      // eslint-disable-next-line no-console
      console.log(err)

      throw new Error('COULD_NOT_CREATE_TASK_SOLUTION')
    })
  }

  throw new Error('COULD_NOT_CREATE_TASK_SOLUTION')
})
