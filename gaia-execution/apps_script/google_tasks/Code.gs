function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function bridgeToken() {
  var token = PropertiesService.getScriptProperties().getProperty('GAIA_TASKS_BRIDGE_TOKEN');
  if (!token) throw new Error('GAIA_TASKS_BRIDGE_TOKEN is not configured in Script Properties');
  return token;
}

function authorise(request) {
  if (!request || !request.token || request.token !== bridgeToken()) {
    throw new Error('Unauthorized');
  }
}

function doGet(e) {
  return dispatch(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  var request = {};
  try {
    request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (error) {
    return jsonResponse({status: 'error', error: 'Invalid JSON'});
  }
  return dispatch(request);
}

function dispatch(request) {
  try {
    authorise(request);
    var action = request.action;
    if (action === 'list_tasklists') return jsonResponse(listTasklists());
    if (action === 'list_tasks') return jsonResponse(listTasks(request));
    if (action === 'create_task') return jsonResponse(createTask(request));
    if (action === 'complete_task') return jsonResponse(completeTask(request));
    return jsonResponse({status: 'error', error: 'Unknown action'});
  } catch (error) {
    return jsonResponse({status: 'error', error: String(error.message || error)});
  }
}

function listTasklists() {
  var response = Tasks.Tasklists.list({maxResults: 100});
  return {status: 'ok', tasklists: response.items || []};
}

function listTasks(request) {
  var tasklistId = request.tasklist_id || '@default';
  var response = Tasks.Tasks.list(tasklistId, {
    maxResults: 100,
    showCompleted: Boolean(request.show_completed),
    showHidden: false
  });
  return {status: 'ok', tasklist_id: tasklistId, tasks: response.items || []};
}

function createTask(request) {
  if (!request.title) throw new Error('title is required');
  var tasklistId = request.tasklist_id || '@default';
  var resource = {title: String(request.title)};
  if (request.notes) resource.notes = String(request.notes);
  if (request.due) resource.due = String(request.due);
  var task = Tasks.Tasks.insert(resource, tasklistId);
  return {status: 'ok', task: task};
}

function completeTask(request) {
  if (!request.task_id) throw new Error('task_id is required');
  var tasklistId = request.tasklist_id || '@default';
  var resource = {status: 'completed', completed: new Date().toISOString()};
  var task = Tasks.Tasks.patch(resource, tasklistId, String(request.task_id));
  return {status: 'ok', task: task};
}
