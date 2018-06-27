const moment = require('moment');
const ObjectiveModel = require('../../models/objective');
const TaskModel = require('../../models/task');
const WorkEntryModel = require('../../models/work_entry');
const ProjectModel = require('../../models/project');
const InvoiceModel = require('../../models/invoice');
const ObjectId = require('mongoose').Types.ObjectId;
const utils = require('./setup.utils');
const { setupWorkEntries } = require('./setup.work_entries');

const allIds = {
	projects: [new ObjectId(), new ObjectId()],
	tasks: [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()],
	objectives: [new ObjectId(), new ObjectId(), new ObjectId(), new ObjectId()]
}

exports.setup = function() {
	return setupProjects.bind(this)()
		.then((projects) => {
			this.projects = projects; // this = sharedData
			return setupTasks.bind(this)()
		})
		.then((tasks) => {
			this.tasks = tasks;
			return setupObjectives.bind(this)()
		})
		.then((objectives) => {
			this.objectives = objectives;
			return setupWorkEntries.bind(this)()
		})
		.then((entries) => {
			this.workEntries = entries;
			return setupInvoices.bind(this)()
		})
		.then((invoices) => {
			this.invoices = invoices;
			return invoices;
		})
}

exports.tearDown = function() {
	return InvoiceModel.remove({})
		.then(() => WorkEntryModel.remove({}))
		.then(() => ObjectiveModel.remove({}))
		.then(() => TaskModel.remove())
		.then(() => ProjectModel.remove())
}

function setupInvoices() {
	const user = this.users[0]._id;
	const ids = allIds.projects;

	return createInvoices([
		{
			invoicing_date: moment().toDate(),
			amount: 55*80,
			billed_hours: 80,
			paid: true,
			description: 'Sample invoice 1.1',
			project: ids[0],
			created_by: user,
			work_entries: [],
			direction: "out",
		},
		{
			invoicing_date: moment().add(-1,'months').toDate(),
			amount: 55*5,
			billed_hours: 5,
			paid: false,
			description: 'Sample invoice 1.2',
			project: ids[0],
			created_by: user,
			work_entries: [],
			direction: "out",
		}
	])
}

function setupProjects() {
	const user = this.users[0]._id;
	const ids = allIds.projects;
	return createProjects([
		{
			_id: ids[0],
			name: 'Sample project 1',
			hours_sold: 100,
			hours_sold_unit: 'total',
			hourly_rate: 55,
			active: true,
		},
		{
			_id: ids[1],
			name: 'Sample project 2',
			hours_sold: 20,
			hours_sold_unit: 'monthly',
			hourly_rate: 55,
			active: true,
		}
	])
}

function setupTasks() {
	const ids = allIds.tasks;
	const user = this.users[0]._id;
	return createTasks([
		{
			_id: ids[0],
			title: 'Sample task 1',
			created_by: user,
			project: allIds.projects[0],
			origin: 'web'
		},
		{
			_id: ids[1],
			title: 'Sample task 2',
			created_by: user,
			project: allIds.projects[0],
			origin: 'web'
		},
		{
			_id: ids[2],
			title: 'Sample task 3',
			created_by: user,
			project: allIds.projects[0],
			origin: 'web'
		},
		{
			_id: ids[3],
			title: 'Sample task 4',
			created_by: user,
			project: allIds.projects[1],
			origin: 'web'
		}
	])
}

function setupObjectives() {
	const ids = allIds.objectives;
	const user = this.users[0]._id;
	return createObjectives([
		{
			_id: ids[0],
			related_task: allIds.tasks[0],
			created_by: user,
			objective_date: moment().toDate(),
			level: 'day',
			owners: [user]
		},
		{
			_id: ids[1],
			related_task: allIds.tasks[1],
			created_by: user,
			objective_date: moment().toDate(),
			level: 'day',
			owners: [user]
		},
		{
			_id: ids[2],
			related_task: allIds.tasks[2],
			created_by: user,
			objective_date: moment().toDate(),
			level: 'day',
			owners: [user]
		},
		{
			_id: ids[3],
			related_task: allIds.tasks[3],
			created_by: user,
			objective_date: moment().toDate(),
			level: 'day',
			owners: [user]
		}
	])
}

function createProjects(items) {
	return utils.createDocs(ProjectModel, items);
}

function createObjectives(items) {
	return utils.createDocs(ObjectiveModel, items);
}

function createTasks(items) {
	return utils.createDocs(TaskModel, items);
}
function createWorkEntries(items) {
	return utils.createDocs(WorkEntryModel, items);
}

function createInvoices(items) {
	return utils.createDocs(InvoiceModel, items);
}
