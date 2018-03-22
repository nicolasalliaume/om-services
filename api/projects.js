const ProjectModel = require('./../models/project');
const WorkEntryModel = require('./../models/work_entry');
const TaskModel = require('./../models/task');
const ObjectiveModel = require('./../models/objective');
const moment = require('moment');
const WorkEntriesApi = require('./work_entries');
const multer = require('multer');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/images/featured_projects')
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname)
  }
})
let upload = multer({ storage });

/*
	POST	/api/{v}/projects/add

	POST	/api/{v}/projects/:id

	GET		/api/{v}/projects

	GET 	/api/{v}/public/projects
 */
exports.setup = (router) => {
	// public APIs, return only public information
	router.get('/public/projects', exports.getProjectsPublic);

	router.get('/projects', exports.getProjects);
	router.post('/projects/add', upload.any(), exports.createProject);
	router.post('/projects/:projectId', upload.any(), exports.updateProject);
}

exports.createProject = function(req, res) {
	const projectData = req.body;
	projectData.featured_image = req.files.length > 0 ? req.files[0].path.replace('public/', '') : null;
	const model = new ProjectModel(projectData);
	ProjectModel.create(model)
		.then(res.json.bind(res))
		.catch((e) => {
			res.json({ error: e.message })
		});
}

exports.updateProject = function(req, res) {
	const _id = req.params.projectId;
	req.body.featured_image = req.files.length > 0 ? req.files[0].path.replace('public/', '') : null;
	ProjectModel.update({ _id }, { $set : req.body })
		.then(res.json.bind(res))
		.catch(e => {
			res.json({ error: e.message })
		})
}

exports.getProjects = function(req, res) {
	ProjectModel.find({}, {invoices: 0}).sort({name: 1})
		.then(projects => {
			res.json({ projects })
		})
		.catch((e) => {
			res.json({ error: e.message })
		})
}

exports.getProjectsPublic = function(req, res) {
	const fields = {
		_id: 0, 
		name: 1, 
		description: 1, 
		active: 1,
		featured: 1,
		featured_image: 1,
		description: 1,
		description_es: 1,
		external_link: 1,
		type: 1,
	};
	ProjectModel.find({}, fields).sort({name: 1})
		.then(projects => { 
			res.json(projects) 
		})
		.catch(e => { 
			res.json({ error: e.message }) 
		})
}
