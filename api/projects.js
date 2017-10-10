const ProjectModel = require('./../models/project');
const WorkEntryModel = require('./../models/work_entry');
const TaskModel = require('./../models/task');
const ObjectiveModel = require('./../models/objective');
const moment = require('moment');

// pdf export of invoice
const fs = require('fs');
const pugpdf = require('pug-pdf');

/*
	POST	/api/{v}/projects/add

	POST	/api/{v}/projects/:id

	GET		/api/{v}/projects

	GET 	/api/{v}/projects/billing

	POST 	/api/{v}/projects/:id/invoices/add-invoice

	GET 	/api/{v}/projects/:id/invoices/:invoiceId

	POST 	/api/{v}/projects/:id/invoices/:invoiceId

	DELETE 	/api/{v}/projects/:id/invoices/:invoiceId
 */
exports.setup = (router) => {
	router.get('/projects', exports.getProjects);
	router.post('/projects/add', exports.createProject);
	router.get('/projects/billing', exports.getProjectsBilling);
	router.post('/projects/:projectId', exports.updateProject);
	router.post('/projects/:projectId/invoices/add-invoice', exports.addInvoice);
	router.post('/projects/:projectId/invoices/:invoiceId', exports.updateInvoice);
	router.get('/projects/:projectId/invoices/:invoiceId', exports.renderInvoice);
	router.get('/projects/:projectId/invoices/:invoiceId/pdf', renderInvoicePdf);
	router.delete('/projects/:projectId/invoices/:invoiceId', exports.deleteInvoice);
}

exports.createProject = function(req, res) {
	const projectData = req.body;
	const model = new ProjectModel(projectData);
	ProjectModel.create(model)
		.then(res.json.bind(res))
		.catch((e) => {
			res.json({ error: e.message })
		});
}

exports.updateProject = function(req, res) {
	const _id = req.params.projectId;
	ProjectModel.update({ _id }, { $set : req.body })
		.then(res.json.bind(res))
		.catch((e) => {
			res.json({ error: e.message })
		})
}

exports.getProjects = function(req, res) {
	ProjectModel.find({active: true}, {invoices: 0}).sort({name: 1})
		.then((projects) => {
			res.json({ projects })
		})
		.catch((e) => {
			res.json({ error: e.message })
		})
}

exports.addInvoice = function(req, res) {
	const projectId = req.params.projectId;
	const invoice = req.body;
	ProjectModel.findByIdAndUpdate(projectId, {$push: {invoices: invoice}})
		.then(result => { res.json(result) })
		.catch(e => { res.json({ error: e.message }) });
}

exports.updateInvoice = function(req, res) {
	const { projectId, invoiceId } = req.params;
	const invoice = req.body;
	ProjectModel.update({ _id: projectId, 'invoices._id': invoiceId },
			{$set: {'invoices.$': invoice}})
		.then(result => { res.json(result) })
		.catch(e => { res.json({ error: e.message })})
}

exports.deleteInvoice = function(req, res) {
	const { projectId, invoiceId } = req.params;
	ProjectModel.update({ _id: projectId }, {$pull: {invoices: {_id: invoiceId}}})
		.then(result => { res.json(result) })
		.catch(e => { res.json({ error: e.message }) })
}

exports.renderInvoice = function(req, res) {
	const { projectId, invoiceId } = req.params;
	ProjectModel.findById({ _id: projectId })
		.populate('invoices.project', 'name')
		.then(doc => doc.invoices.id(invoiceId))
		.then(invoice => {
			res.render('invoice', { invoice })
		})
		.catch(error => { res.render('error', { error }) })
}

exports.getProjectsBilling = function(req, res) {
	ProjectModel.find({active: true})
		.sort({name: 1})
		.populate('invoices.project', 'name')
		.lean()
		.then(projects => exports.calculateBillingVariables(projects))
		.then(projects => { res.json(projects) })
		.catch((e) => {
			console.error(e);
			res.json({ error: e.message })
		})
}

/**
 * Here we calculate the following variables for each project
 * and resolve the promise with the variabled added to each
 * project object:
 * 
 * 	- amount billed this month
 * 	- amount billed total
 * 	- hours registered this month
 * 	- hours registered total
 * 	
 * @param  {Array} projects 
 * @return {Promise}
 */
exports.calculateBillingVariables = function(projects) {
	return new Promise((resolve, reject) => {
		// calculate hours executed for this month and total
		const promises = exports.calculateExecutedHoursForProjects(projects);
		// after calculating executed hours, we calculate 
		// billed hours, merge all that data into the projects
		// and resolve this function's promise
		Promise.all(promises).then(hours => {
			const result = projects.map((p, idx) => {
				return Object.assign({}, p, hours[idx], {
					billed_hours_month  : exports.calculateThisMonthBillingHours(p),
					billed_amount_month : exports.calculateThisMonthBillingAmount(p),
					billed_hours_total  : exports.calculateTotalBillingHours(p),
					billed_amount_total : exports.calculateTotalBillingAmount(p)
				})
			})
			return resolve(result);
		})
		.catch(error => reject(error));
	})
}

exports.calculateExecutedHoursForProjects = function(projects) {
	const promises = projects.map(p => {
		return Promise.all([
			exports.calculateThisMonthExecuted(p._id),
			exports.calculateTotalExecuted(p._id)
		]).then(([month, total]) => {
			return {
				executed_hours_month : month / 3600,
				executed_hours_total : total / 3600
			}
		})
	})
	return promises;
}

exports.calculateTotalExecuted = function(projectId) {
	return exports.getWorkEntriesForProject(projectId)
		.then(workEntries => reduceWorkEntries(workEntries))
}

exports.calculateThisMonthExecuted = function(projectId) {
	return exports.getWorkEntriesForProject(projectId, getFilterForMonth(new Date()))
		.then(workEntries => reduceWorkEntries(workEntries))
}

const reduceWorkEntries = function(workEntries) {
	return workEntries.map(we => we.time).reduce((total, t) => t+total, 0);
}

exports.getWorkEntriesForProject = function(projectId, filters = {}) {
	return getTasksForProject(projectId)
		.then(taskIds => getObjectivesForTasks(taskIds))
		.then(objectiveIds => getWorkEntriesForObjectives(objectiveIds, filters))
}

function getWorkEntriesForObjectives(objectiveIds, filters) {
	const query = Object.assign({}, filters, {objective: {$in: objectiveIds}});
	return WorkEntryModel.find(query).lean();
}

function getObjectivesForTasks(taskIds) {
	return ObjectiveModel.find({related_task: {$in: taskIds}})
		.lean().then(docs => docs.map(d => d._id));
}

function getTasksForProject(projectId) {
	return TaskModel.find({project: projectId})
		.lean().then(docs => docs.map(d => d._id));
}

exports.calculateThisMonthBillingHours = function(project) {
	return exports.reduceInvoicesFieldWithCondition('billed_hours', 
		i => isThisMonth(i.invoicing_date), project.invoices);
}

exports.calculateThisMonthBillingAmount = function(project) {
	return exports.reduceInvoicesFieldWithCondition('amount', 
		i => isThisMonth(i.invoicing_date), project.invoices);
}

exports.calculateTotalBillingHours = function(project) {
	return exports.reduceInvoicesFieldWithCondition('billed_hours', 
		i => true, project.invoices);
}

exports.calculateTotalBillingAmount = function(project) {
	return exports.reduceInvoicesFieldWithCondition('amount', 
		i => true, project.invoices);
}

exports.reduceInvoicesFieldWithCondition = function(field, condition, invoices) {
	return sum(invoices.filter(condition).map(i => i[field]));
}

const isThisMonth = (date) => moment.utc(date).format('YYYY/MM') === moment.utc().format('YYYY/MM');

const sum = (numbers) => numbers.reduce((total, n) => n+total, 0);

const getFilterForMonth = (date) => {
	const fromDate = moment.utc(date).startOf('month').toDate();
	const toDate = moment.utc(date).endOf('month').toDate();
	return { created_ts: {$gte: fromDate, $lte: toDate} }
}

function renderInvoicePdf(req, res) {
	const tmpFilename = 'invoice_' + moment().format('x') + '.pdf';
	const tmpFile = __dirname + '/../tmp/' + tmpFilename;
	const stream = fs.createWriteStream(tmpFile);
	const css = __dirname + '/../public/stylesheets/invoice.css';

	const { projectId, invoiceId } = req.params;

	ProjectModel.findById({ _id: projectId })
		.populate('invoices.project', 'name')
		.then(doc => doc.invoices.id(invoiceId))
		.then(invoice => {
			fs.createReadStream(__dirname + '/../views/invoice.pug')
				.pipe(pugpdf({
					cssPath : css,
					locals  : { invoice, moment }
				}))
				.pipe(stream);
		})
		.catch(error => { res.render('error', { error }) })	

	stream.on('finish', function () { 
		fs.readFile(tmpFile, function(err, data) {
			res.setHeader('Content-Disposition', 'attachment; filename=' + tmpFilename);
			res.setHeader('Content-Type', 'application/pdf');                
			res.setHeader('Content-Length', data.length);
			res.status(200).end(data, 'binary');
		});
	});
}