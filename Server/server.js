// Node package require statements
const express = require("express");
const cookieParser = require('cookie-parser');
const session = require("client-sessions");
const http = require("http");
const MongoClient = require('mongodb').MongoClient;

// Require custom node modules
const MongoConnection = require('./databaseFunctions');

// Port used to listen for connections 
// If hosted on Heroku, the port is defined by the service
// If hosted locally the port is 9000
const port = process.env.PORT || 9000;

// Initialise the Express app.
app = express();

// Create HTTP server.
server = http.createServer(app);

// Set up express to parse JSON data from a request body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up express to parse cookies
app.use(cookieParser());

// Set up session variables
app.use(session
({
	cookieName: "map_session",
	duration: 0.5 * 60 * 1000,
	activeDuration: 0.5 * 60 * 1000
}));

// Set up static routes
app.use(express.static(__dirname + '/../Client/Scripts/'));

/***************/
/* Page Routes */
/***************/

// Default route. Directs to a log-in page
app.get("/", function(request, response)
{
	response.sendFile("/Client/login.html", {"root": __dirname + "/../"});
});

// Registration route
app.get("/register", function(request, response)
{
	response.sendFile("/Client/register.html", {"root": __dirname + "/../"});
});

// Placeholder secure route
app.get("/secure", function(request, response)
{
	response.send("Secure Page Accessed");
});

/**************/
/* API Routes */
/**************/

// Route to authenticate a user record
app.post("/login", function(request, response)
{
	// Retrieve request body and create a MongoDB connection
	let body = request.body;	
	let connection = new MongoConnection(uri);
	
	// Convert request body data into easily usable JSON
	let inputData = 
	{
		username: body.username,
		password: body.password,
	}
	
	// Authenticate the record
	connection.AuthenticateAccount(inputData).then(function(res)
	{		
		if (res == true)
		{
			response.redirect("/secure");
		}
		else
		{
			response.cookie("Alert", "Log in unsuccessful. Please try again with the correct details.", {maxAge: 30000});
			response.redirect("/");
		}
	})
	.catch(function(err)
	{
		response.send(err);
	});
});

// Route to insert new user account record
app.post("/user-accounts", function(request, response)
{
	// Retrieve request body and create a MongoDB connection
	let body = request.body;	
	let connection = new MongoConnection(uri);
	
	// Convert request body data into easily usable JSON
	let inputData = 
	{
		username: body.username,
		password: body.password,
		emailAddress: body.emailAddress
	}
	
	// Create a second JSON object for user authentication
	let authenticationData = 
	{
		username: body.username, 
		password: body.password
	};
	
	// Add the record
	connection.AddUserAccount(inputData).then(function(res)
	{		
		response.cookie("Alert", "Registration Successful! Please log in.", {maxAge: 30000});
		response.redirect("/");
	})
	.catch(function(err)
	{
		if (!err.usernamePresent)
		{
			response.cookie("Alert", "No username entered. Please enter a username.", {maxAge: 30000});
			response.redirect("/register");
		}
		else if (!err.passwordPresent)
		{
			response.cookie("Alert", "No password entered. Please enter a password.", {maxAge: 30000});
			response.redirect("/register");
		}
		else if (!err.emailAddressPresent)
		{
			response.cookie("Alert", "No email address entered. Please enter an email address.", {maxAge: 30000});
			response.redirect("/register");
		}
		else if (!err.emailAddessValid)
		{
			response.cookie("Alert", "The email address entered is invalid. Please use a valid email address.", {maxAge: 30000});
			response.redirect("/register");
		}
		else if (!err.usernameUnique)
		{
			response.cookie("Alert", "The username is taken, please use a different username.", {maxAge: 30000});
			response.redirect("/register");
		}
		else
		{
			response.cookie("Alert", "Error received: " + err + ".", {maxAge: 30000});
			response.redirect("/register");
		}
	});
});

// HelloWorld route
app.get("/HelloWorld", function(request, response)
{
	// Set up connection variables
	var client = new MongoClient(uri, { useNewUrlParser: true });
	
	// Connect to the MongoDB instance
	client.connect().then(function(dbResponse)
	{
		// Retrieve database record
		var dbObject = dbResponse.db("HelloWorld");
		
		try
		{
			// Create the "HelloWorld" collection
			dbObject.createCollection("HelloWorld").then(function(res)
			{
				// Insert test record
				dbObject.collection("HelloWorld").insertOne( {data: "Hello World"} ).then(function(res)
				{
					client.close();
					response.send(res);	
				})
				.catch(function(err)
				{
					client.close();
					response.send("Failed on insertion " + err);
				});
			})
			.catch(function(err)
			{
				client.close();
				response.send("Failed on creation " + err);
			});
		}
		catch(err)
		{
			client.close();
			response.send("Exception caught " + err);
			
		};
	})
	.catch(function(err)
	{
		client.close();
		response.send("Failed on MongoDB connection " + err);
	});
});

// Listen for connections
server.listen(port, function()
{
	console.log("Listening on " + port);
});