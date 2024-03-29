SelectTypes = 
{
	SELECT: "select",
	ADD: "add",
	REMOVE: "remove",
	CHARACTER: "character",
	HIDDEN_REGION: "hidden_region",
	ADD_BLOCK_TO_REGION: "add_block_to_region",
	REMOVE_BLOCK_FROM_REGION: "remove_block_from_region"
};

SessionTypes = 
{
	HOST: "host",
	CLIENT: "client",
	EDIT: "edit"
};

class MapScreen
{
	constructor()
	{
		// Retrieve the current username
		this.GetCurrentUser();

		// Map size variables
		this.xDimension = 125;
		this.yDimension = 125;
		this.count = this.xDimension * this.yDimension + 1;

		// Raycasting variables
		this.pickPosition = {x: 0, y: 0};
		this.mouseClicked = false;
		this.pickHelper;

		// Bind the rendering function to a single instance
		this.render = this.Render.bind(this);

		// User interaction variables
		this.brushSize = 1;
		this.brushValue = 1;
		this.activeSelectType = SelectTypes.SELECT;
		this.html = new HTMLGenerator(this);

		// Initialise modal objects to retrieve DOM elements and set up event listeners
		this.processModal = new ProcessModal();
		this.alertModal = new AlertModal();
    
		this.rendering = false;
		this.DetermineSessionType();
	}

	GetCurrentUser()
	{
		$.get("/getUser", function(data, status)
		{
			this.currentUser = data;
		}.bind(this));
	}

	/*
	* Initialises the canvas, renderer, scene and camera, ready for display.
	*/
	InitialiseScene()
	{
		// Get canvas and pass it to the renderer
		this.canvas = document.querySelector("#c");
		this.renderer = new THREE.WebGLRenderer({canvas: this.canvas});

		// Set up default values for the camera
		const fov = 35;
		const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		const near = 0.1;
		const far = 10000;
		this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		this.camera.position.y = 15;
		this.camera.position.x = 0;
		this.camera.position.z = 0;

		// Load textures
		this.topTexture = new THREE.TextureLoader().load("/tex.png");
		this.topTexture.magFilter = THREE.NearestFilter;

		this.sideTexture = new THREE.TextureLoader().load("/texSide.png");
		this.sideTexture.magFilter = THREE.NearestFilter;
		this.sideTexture.wrapS = THREE.RepeatWrapping;
		this.sideTexture.wrapT = THREE.RepeatWrapping;
		this.sideTexture.repeat.set(2, 12);

		// Create orbital camera control with the mouse
		const controls = new THREE.OrbitControls(this.camera, this.canvas);
		controls.target.set(this.xDimension / 2, 0, this.yDimension / 2);
		controls.update();

		document.addEventListener("DrawBlock", this.DrawBlock.bind(this));
		document.addEventListener("SelectBlock", this.SelectBlock.bind(this));
		document.addEventListener("AddCharacter", this.AddCharacter.bind(this));
		document.addEventListener("CursorHover", this.PickHoveredObject.bind(this));
		document.addEventListener("DeleteCharacter", this.DeleteCharacter.bind(this));
		document.addEventListener("SetBlockHeight", this.SetBlockHeight.bind(this))
		document.addEventListener("UpdateMap", this.UpdateMap.bind(this));
		document.addEventListener("MoveCharacter", this.PickUpCharacter.bind(this));
		document.addEventListener("AddBlockToHiddenRegion", this.AddBlockToHiddenRegion.bind(this));
		document.addEventListener("RemoveBlockFromHiddenRegion", this.RemoveBlockFromHiddenRegion.bind(this));
		document.addEventListener("ToggleHiddenRegionVisibility", this.ToggleRegionVisibility.bind(this));
		document.addEventListener("AddNewHiddenRegion", this.AddNewRegion.bind(this));
		document.addEventListener("RemoveHiddenRegion", this.RemoveRegion.bind(this));
		document.addEventListener("SelectRegionToEdit", this.SelectRegionToEdit.bind(this));
	}

	RenderScene()
	{
		// Initialise a new scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x6bfff8);

		let hoverMaterial = new THREE.MeshPhongMaterial();
		hoverMaterial.color = new THREE.Color("red");
		hoverMaterial.opacity = 0.75;
		hoverMaterial.transparent = true;

		// Create directional light source
		const color = 0xFFFFFF;
		const intensity = 1;

		var light = new THREE.DirectionalLight(color, intensity);
		light.position.set(3, 2, 2);
		light.target.position.set(0, 0, 0);
		this.scene.add(light);
		this.scene.add(light.target);

		var light = new THREE.DirectionalLight(color, intensity);
		light.position.set(-3, 2, -2);
		light.target.position.set(0, 0, 0);
		this.scene.add(light);
		this.scene.add(light.target);

		// Set up the instanced box geometry
		let boxGeometry = new THREE.BoxGeometry(1, 1, 1);
		let instancedGeometry = new THREE.InstancedBufferGeometry();
		instancedGeometry.fromGeometry(boxGeometry);

		// Set up the box materials
		var instancedMaterials = 
		[
			new THREE.MeshPhongMaterial( { map: this.sideTexture }),
			new THREE.MeshPhongMaterial( { map: this.sideTexture }),
			new THREE.MeshPhongMaterial( { map: this.topTexture, vertexColors: THREE.VertexColors }),
			new THREE.MeshPhongMaterial( { map: this.sideTexture }),
			new THREE.MeshPhongMaterial( { map: this.sideTexture }),
			new THREE.MeshPhongMaterial( { map: this.sideTexture }),
		];

		// Set up a colour buffer for the box mesh
		instancedGeometry.setAttribute( 'color', new THREE.InstancedBufferAttribute( this.mapMatrix.colourArray, 3 ) );

		// Set up the final instanced mesh and add to the scene
		this.mapMesh = new THREE.InstancedMesh( instancedGeometry, instancedMaterials, this.count);
		this.mapMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); // will be updated every frame
		this.scene.add(this.mapMesh);

		// Set up the instanced hidden box geometry
		boxGeometry = new THREE.BoxGeometry( 0.75, 1, 0.75);
		let hiddenInstancedGeometry = new THREE.InstancedBufferGeometry();
		hiddenInstancedGeometry.fromGeometry(boxGeometry);

		// Set up the instanced hidden box material
		let hiddenMaterial = new THREE.MeshPhongMaterial();
		hiddenMaterial.color = new THREE.Color("grey");
		hiddenMaterial.opacity = 0.75;
		hiddenMaterial.transparent = false;

		// Set up the final instanced mesh and add to the scene
		this.hiddenMesh = new THREE.InstancedMesh( hiddenInstancedGeometry, hiddenMaterial, this.count);
		this.hiddenMesh.name = "Hidden Blocks";
		this.hiddenMesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage ); // will be updated every frame
		this.scene.add(this.hiddenMesh);

		// Set up the character cylinder geometry
		var characterGeometry = new THREE.CylinderGeometry( 0.75, 0, 2, 8 );

		// Iterate through the height map and move instances to fill the generated map
		const matrix = new THREE.Matrix4();
		const dummy = new THREE.Object3D();
		const hiddenDummy = new THREE.Object3D();
		let gridOffset = 0;
		let hiddenOffset = 0;

		for (let i = 0; i < this.mapMatrix.heightMap.length; i++)
		{
			for (let j = 0; j < this.mapMatrix.heightMap[i].length; j++)
			{
				// Retrieve each instance transformation matrix
				gridOffset++;
				this.mapMesh.getMatrixAt(gridOffset, matrix);
				let value = this.mapMatrix.heightMap[i][j];

				// Set a dummy object position to transform the instance being modified
				dummy.position.set(i, value / 2, j);
				dummy.updateMatrix();

				if (this.mapMatrix.hiddenBlockMatrix[i][j] == true)
				{
					dummy.matrix.elements[5] = 1;
					dummy.matrix.elements[13] = 1 / 2;

					if (this.sessionType != SessionTypes.CLIENT)
					{
						// Set a dummy object position to transform the instance being modified
						hiddenDummy.position.set(i, value / 2, j);
						hiddenDummy.updateMatrix();

						hiddenDummy.matrix.elements[5] = value + 0.15;
						hiddenDummy.matrix.elements[13] = value / 2;
						this.hiddenMesh.setMatrixAt(hiddenOffset, hiddenDummy.matrix);

						hiddenOffset++;
					}
				}
				else
				{
					dummy.matrix.elements[5] = value;
					dummy.matrix.elements[13] = value / 2;
				}

				this.mapMesh.setMatrixAt( gridOffset, dummy.matrix );

				// If a character is present on a space, add a character token to that space in the render
				if (this.mapMatrix.GetCharacter(i, j) != null)
				{
					if (this.sessionType == SessionTypes.CLIENT)
					{
						if (!this.mapMatrix.hiddenBlockMatrix[i][j])
						{
							// Set up individual materials for each character token
							const characterMaterial = new THREE.MeshPhongMaterial();
							characterMaterial.color = new THREE.Color("red");
							characterMaterial.opacity = 0.75;
							characterMaterial.transparent = true;
							
							// Create the mesh and set the position
							let characterMesh = new THREE.Mesh( characterGeometry, characterMaterial);
							characterMesh.position.set(i, value + 1.25, j);
							characterMesh.name = "Character";
							this.scene.add(characterMesh);
						}
					}
					else
					{
						// Set up individual materials for each character token
						const characterMaterial = new THREE.MeshPhongMaterial();
						characterMaterial.color = new THREE.Color("red");
						characterMaterial.opacity = 0.75;
						characterMaterial.transparent = true;
						
						// Create the mesh and set the position
						let characterMesh = new THREE.Mesh( characterGeometry, characterMaterial);
						characterMesh.position.set(i, value + 1.25, j);
						characterMesh.name = "Character";
						this.scene.add(characterMesh);
					}
				}
			}
		}

		// Flag the matrix for updating
		this.mapMesh.instanceMatrix.needsUpdate = true;
		this.hiddenMesh.instanceMatrix.needsUpdate = true;

		// Create a new helper class to assist in raycasting and object picking, then begin the render cycle
		this.pickHelper = new InstancedObjectPicker(this.scene);

		// If the render loop has not yet been started, begin rendering
		if (this.rendering == false)
		{
			this.rendering = true;
			this.BeginRendering();
		}
	}

	UpdateMap()
	{
		if (this.sessionType == SessionTypes.HOST || this.sessionType == SessionTypes.CLIENT)
		{
			this.socket.emit("host_send_map", this.mapMatrix);
			console.log("W");
		}

		this.RenderScene();
	}

	/*
	* Load a map from the database based on the URL parameters
	*/
	LoadMapFromDatabase()
	{
		// Retrieve the last part of the URL, the ID
		let urlParameter = document.location.href.split('/');
		let id = urlParameter[urlParameter.length - 1];

		// Construct a new map and load from a file
		this.mapMatrix = new Map();

		this.processModal.Show("Loading map file, please wait.");

		this.mapMatrix.LoadMap(id).then(function() 
		{
			this.processModal.Hide();
			this.RenderScene();
		}.bind(this));
	}

	LoadMapFromWebSocket()
	{
		this.socket.emit("client_request_map");
		this.InitialiseRefresh();
	}

	InitialiseRefresh()
	{
		this.socket.on("server_send_map", function(map)
		{
			// Load the map and construct a new scene
			this.mapMatrix.LoadFromRecord(map);
			this.RenderScene();
		}.bind(this));
	}

	/*
	* Save the current map to the database
	*/
	SaveMap()
	{
		this.processModal.Show("Saving map, please wait.");

		this.mapMatrix.SaveMap().then(function()
		{
			this.processModal.Hide();
			this.alertModal.Show("Map Saved!");
		}.bind(this));
	}

	/*
	* Determines the type of session and the initialisation process to carry out
	*/
	DetermineSessionType()
	{
		// Retrieve the session type cookie
		let sessionCookie = $.cookie("SessionType");
		
		// If the cookie exists, determine the session type and initialise, otherwise direct back to the list page
		if (sessionCookie != null)
		{
			$.removeCookie("SessionType");

			switch(sessionCookie)
			{
				case SessionTypes.HOST:
					this.HostSessionInitialise();
					break;

				case SessionTypes.CLIENT:
					this.ClientSessionInitialise();
					break;

				case SessionTypes.EDIT:
					this.EditSessionInitialise();
					break;
			}
		}
		else
		{
			window.location.href = "/list";
		}
	}

	/*
	* Initialises the editor for session hosting
	*/
	HostSessionInitialise()
	{
		this.sessionType = SessionTypes.HOST;

		// Initialise environment
		this.InitialiseScene();
		this.LoadMapFromDatabase();
		this.InitialiseEventListeners();

		// Connect and create a session
		this.socket = io();
		this.socket.emit("create_session");

		this.InitialiseRefresh();

		// Set up event handlers if the session is successfully created
		this.socket.on("session_created_successfully", function()
		{
			this.alertModal.Show("Players can enter this code to join: " + this.socket.id);

			// If the server requests map data, send
			this.socket.on("server_request_map", function()
			{
				this.socket.emit("host_send_map", this.mapMatrix);
			}.bind(this));
		}.bind(this));
	}

	/*
	* Initialises the editor for client session joining
	*/
	ClientSessionInitialise()
	{
		this.sessionType = SessionTypes.CLIENT;

		// Retrieve the session ID cookie
		let sessionID = $.cookie("SessionID");

		// Connect and create a session
		this.socket = io();
		this.socket.emit("join_session", sessionID);

		// Set up event handlers if the session is successfully joined
		this.socket.on("session_joined_successfully", function()
		{
			// Initialise environment
			this.mapMatrix = new Map();
			this.InitialiseScene();
			this.LoadMapFromWebSocket();
			this.InitialiseEventListeners();

		}.bind(this));
	}

	/*
	* Initialises the editor for map editing
	*/
	EditSessionInitialise()
	{
		this.sessionType = SessionTypes.EDIT;

		this.InitialiseScene();
		this.LoadMapFromDatabase();
		this.InitialiseEventListeners();
	}

	/*
	* Modifies the camera projection matrix and the canvas rendering resolution
	* to account for modified canvas size.
	*/
	ResizeDisplay()
	{
		// Modify the camera aspect
		this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
		this.camera.updateProjectionMatrix();
		
		// Modify the internal rendering resolution
		this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight, false);
	}

	/*
	* Modifies the height of a block incrementally or decrementally in the heightmap and then modifies the associated instance matrix to re-render it.
	*/
	DrawBlock(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;
		let instance = e.detail.instance;

		console.log(object);

		// Internal function to increment the height of selected blocks
		let modifyHeight = function()
		{
			let value;

			// Increment or decrement based on selection type
			if (this.activeSelectType == SelectTypes.ADD)
			{
				// Increase the height value of the corresponding element in the map matrix
				value = this.mapMatrix.AddToHeight(matrix.elements[12], matrix.elements[14], this.brushValue);
			}
			else if (this.activeSelectType == SelectTypes.REMOVE)
			{
				// Decrease the height value of the corresponding element in the map matrix
				value = this.mapMatrix.AddToHeight(matrix.elements[12], matrix.elements[14], -this.brushValue);
			}

			// Reposition characters on the selected block
			this.RepositionCharacter(matrix.elements[12], value, matrix.elements[14]);

		}.bind(this);

		// Retrieve the transformation matrix for the clicked instance
		let originalMatrix = new THREE.Matrix4();
		object.getMatrixAt(instance, originalMatrix);

		let matrix = new THREE.Matrix4();

		// Iterate through the selected area, the size of the "brush"
		for (let i = -Math.floor(this.brushSize / 2); i <= Math.floor(this.brushSize / 2); i++)
		{
			for (let j = -Math.floor(this.brushSize / 2); j <= Math.floor(this.brushSize / 2); j++)
			{
				matrix.elements[12] = originalMatrix.elements[12] + i;
				matrix.elements[14] = originalMatrix.elements[14] + j;

				if (matrix.elements[12] < 125 && matrix.elements[12] >= 0 && matrix.elements[14] < 125 && matrix.elements[14] >= 0) 
				{
					modifyHeight();
				}
			}
		}

		document.dispatchEvent(new Event("UpdateMap"));
	}

	/*
	* Selects a block on the grid, adding a HTML element to the area.
	*/
	SelectBlock(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;
		let instance = e.detail.instance;

		// Only select a block if an instance exists
		if (instance)
		{
			// Retrieve the transformation matrix for the clicked instance
			let matrix = new THREE.Matrix4();
			object.getMatrixAt(instance, matrix);

			// Retrieve the world position projected from the camera
			let dummy = new THREE.Object3D();
			let tempVector = new THREE.Vector3();
			dummy.position.set(matrix.elements[12], 0, matrix.elements[14]);
			dummy.updateMatrix();
			dummy.getWorldPosition(tempVector);
			tempVector.project(this.camera);

			// Get screen space for placing HTML elements
			let x = (tempVector.x *  .5 + .5) * this.canvas.clientWidth;
			let y = (tempVector.y * -.5 + .5) * this.canvas.clientHeight;

			// Only allow editing if the map is currently hosted or being edited
			let active = (this.sessionType == SessionTypes.HOST || this.sessionType == SessionTypes.EDIT);

			// Add a label
			this.html.AddLabel(x, y, object, instance, active);
		}
	}

	ToggleRegionVisibility(e)
	{
		// Store event variables for shortened code
		let region = e.detail.region;
		let isHidden = e.detail.isHidden;

		this.mapMatrix.RevealHiddenRegion(region, isHidden);

		document.dispatchEvent(new Event("UpdateMap"));
	}

	AddNewRegion(e)
	{
		// Store event variables for shortened code
		let region = e.detail.region;
		this.mapMatrix.AddNewRegion(region);

		document.dispatchEvent(new Event("UpdateMap"));
		document.dispatchEvent(new Event("RefreshLists"));
	}

	RemoveRegion(e)
	{
		let region = e.detail.region;
		this.mapMatrix.RemoveHiddenRegion(region);

		document.dispatchEvent(new Event("UpdateMap"));
		document.dispatchEvent(new Event("RefreshLists"));
	}

	SelectRegionToEdit(e)
	{
		this.SelectedRegion = e.detail.region;
	}

	AddBlockToHiddenRegion(e)
	{
		if (this.SelectedRegion != null)
		{
			// Retrieve matrix data
			let matrix = new THREE.Matrix4();
			this.mapMesh.getMatrixAt(e.detail.instance, matrix);

			this.mapMatrix.AddBlockToHiddenRegion(matrix.elements[12], matrix.elements[14], this.SelectedRegion);

			document.dispatchEvent(new Event("UpdateMap"));
		}
	}

	RemoveBlockFromHiddenRegion(e)
	{
		console.log(this.SelectedRegion);

		if (this.SelectedRegion != null)
		{
			// Retrieve matrix data
			let matrix = new THREE.Matrix4();
			e.detail.object.getMatrixAt(e.detail.instance, matrix);

			this.mapMatrix.RemoveBlockFromHiddenRegion(matrix.elements[12], matrix.elements[14], this.SelectedRegion);

			document.dispatchEvent(new Event("UpdateMap"));
		}
	}

	/*
	* Changes the height of a block in the height map, then re-renders the corresponding instance.
	*/
	SetBlockHeight(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;
		let instance = e.detail.instance;
		let value = e.detail.value;

		// Retrieve the transformation matrix for the clicked instance
		var matrix = new THREE.Matrix4();
		object.getMatrixAt(instance, matrix);

		// Increase the height value of the corresponding element in the map matrix
		var returnedValue = this.mapMatrix.SetHeight(matrix.elements[12], matrix.elements[14], value);

		// Set corresponding values in the transformation matrix for the instance
		matrix.elements[5] = returnedValue;
		matrix.elements[13] = returnedValue / 2;

		// Reposition characters on this block
		this.RepositionCharacter(matrix.elements[12], returnedValue, matrix.elements[14])

		// Set the transformation matrix to the instance and flag it for updates
		object.setMatrixAt(instance, matrix);
		object.instanceMatrix.needsUpdate = true;	

		document.dispatchEvent(new Event("UpdateMap"));
	}

	PickUpCharacter(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;

		// Store the character temporarily
		this.pickedUpCharacter = this.mapMatrix.GetCharacter(object.position.x, object.position.z);
		this.pickedUpObject = this.RetrieveCharacterObject(object.position.x, object.position.z);
		this.pickedUpObject.material.color.set(new THREE.Color("grey"));
	}

	/*
	* Adds or selects a character to / on the map
	*/
	AddCharacter(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;
		let instance = e.detail.instance;

		// If the selected object is an instance of the grid blocks
		if (!instance)
		{
			// Retrieve the transformation matrix for the clicked instance
			let matrix = new THREE.Matrix4();
			matrix = object.position;

			// Get the owner of the selected character
			let owner = this.mapMatrix.GetCharacter(matrix.x, matrix.z).owner;

			// Check if the player is the one that originally placed the character
			let isOwner = (owner == this.currentUser || this.sessionType == SessionTypes.HOST);

			// Retrieve the world position projected from the camera
			let dummy = new THREE.Object3D();
			let tempVector = new THREE.Vector3();
			dummy.position.set(matrix.x, matrix.y, matrix.z);
			dummy.updateMatrix();
			dummy.getWorldPosition(tempVector);
			tempVector.project(this.camera);

			// Get screen space for placing HTML elements
			let x = (tempVector.x *  .5 + .5) * this.canvas.clientWidth;
			let y = (tempVector.y * -.5 + .5) * this.canvas.clientHeight;

			// Add a label
			this.html.AddCharacterLabel(x, y, object, isOwner);

			document.dispatchEvent(new Event("UpdateMap"));
		}

		// If the selected object is a character
		else
		{
			// Retrieve position
			let matrix = new THREE.Matrix4();
			object.getMatrixAt(instance, matrix);

			let characterMesh;

			// Produce a JSON transformation matrix for the clicked object
			let locationMatrix = 
			{
				x: matrix.elements[12],
				y: matrix.elements[13],
				z: matrix.elements[14]
			}

			// If a character is not present, create a new one
			if (this.mapMatrix.GetCharacter(locationMatrix.x, locationMatrix.z) == null)
			{
				if (this.pickedUpCharacter)
				{
					// Set picked up character in the map
					this.mapMatrix.SetCharacter(this.pickedUpObject.position.x, this.pickedUpObject.position.z, null);
					this.mapMatrix.SetCharacter(locationMatrix.x, locationMatrix.z, this.pickedUpCharacter);
					this.scene.remove(this.pickedUpObject);

					this.pickedUpCharacter = null;
					this.pickedUpObject = null;
				}
				else
				{
					// Set new character in the map
					this.mapMatrix.AddCharacter(locationMatrix.x, locationMatrix.z, this.currentUser);
				}

				// Set a material for the hovering box
				let hoverMaterial = new THREE.MeshPhongMaterial();
				hoverMaterial.color = new THREE.Color("red");;
				hoverMaterial.opacity = 0.7;
				hoverMaterial.transparent = true;

				// Retrieve the height value from the map matrix
				let value = this.mapMatrix.heightMap[locationMatrix.x][locationMatrix.z];

				// Set the dimensions of the cube
				let hoverBoxGeometry = new THREE.CylinderGeometry( 0.75, 0, 2, 8 );

				// Create the mesh, set the position and add to the this.scene
				characterMesh = new THREE.Mesh( hoverBoxGeometry, hoverMaterial);
				characterMesh.position.set(locationMatrix.x, value + 1.25, locationMatrix.z);
				characterMesh.name = "Character";

				// Add to the scene
				this.scene.add(characterMesh);
			}
			else
			{
				characterMesh = this.RetrieveCharacterObject(locationMatrix.x, locationMatrix.z);
			}

			// Retrieve the world position projected from the camera
			let dummy = new THREE.Object3D();
			let tempVector = new THREE.Vector3();
			dummy.position.set(locationMatrix.x, locationMatrix.y, locationMatrix.z);
			dummy.updateMatrix();
			dummy.getWorldPosition(tempVector);
			tempVector.project(this.camera);

			// Get screen space for placing HTML elements
			let x = (tempVector.x *  .5 + .5) * this.canvas.clientWidth;
			let y = (tempVector.y * -.5 + .5) * this.canvas.clientHeight;

			// Get the owner of the selected character
			let owner = this.mapMatrix.GetCharacter(locationMatrix.x, locationMatrix.z).owner;

			// Check if the player is the one that originally placed the character
			let isOwner = (owner == this.currentUser || this.sessionType == SessionTypes.HOST);

			// Add a label
			this.html.AddCharacterLabel(x, y, characterMesh, isOwner);

			document.dispatchEvent(new Event("UpdateMap"));
		}
	}

	/*
	* Selects an object when the mouse hovers over an object.
	*/
	PickHoveredObject(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;
		let instance = e.detail.instance;

		if (object.name != "Character")
		{
			// Retrieve the instance transformation matrix
			let matrix = new THREE.Matrix4();
			object.getMatrixAt(instance, matrix);

			// Retrieve the height value from the map matrix
			let value = this.mapMatrix.heightMap[matrix.elements[12]][matrix.elements[14]];

			let hoverBoxGeometry;

			// Set the dimensions of the cube
			if (this.activeSelectType == SelectTypes.ADD || this.activeSelectType == SelectTypes.REMOVE)
			{
				hoverBoxGeometry = new THREE.BoxGeometry(this.brushSize + 0.25, value + 0.25, this.brushSize + 0.25);
			}
			else
			{
				if (this.sessionType == SessionTypes.CLIENT)
				{
					hoverBoxGeometry = new THREE.BoxGeometry(1.25, matrix.elements[5] +  0.25, 1.25);
				}
				else
				{
					hoverBoxGeometry = new THREE.BoxGeometry(1.25, value + 0.25, 1.25);
				}
			}

			// Set a material for the hovering box
			let hoverMaterial = new THREE.MeshPhongMaterial();
			hoverMaterial.color = new THREE.Color("red");
			hoverMaterial.opacity = 0.5;
			hoverMaterial.transparent = true;

			// Create the mesh, set the position and add to the this.scene
			this.cursorMesh = new THREE.Mesh( hoverBoxGeometry, hoverMaterial);

			if (this.sessionType == SessionTypes.CLIENT)
			{
				this.cursorMesh.position.set(matrix.elements[12], matrix.elements[5] / 2, matrix.elements[14]);
			}
			else
			{
				this.cursorMesh.position.set(matrix.elements[12], value / 2, matrix.elements[14]);
			}

			this.scene.add(this.cursorMesh);
		}
	}

	DeleteCharacter(e)
	{
		// Store event variables for shortened code
		let object = e.detail.object;

		// Set the character matrix in the corresponding position to null and remove the rendered object
		this.mapMatrix.SetCharacter(object.position.x, object.position.z, null);
		this.scene.remove(object);
	}

	RetrieveCharacterObject(x, z)
	{
		// Iterate through every object in the scene
		let count = this.scene.children.length;
		
		for (let i = 0; i < count; i++)
		{
			let object = this.scene.children[i];

			// If the object position matches the modified block, modify the object y value to match the new block height
			if (object.position.x == x && object.position.z == z)
			{
				if (object.name == "Character")
				{
					return object;
				}
			}
		}

		return null;
	}

	RepositionCharacter(x, y, z)
	{
		let object = this.RetrieveCharacterObject(x, z);
		if (object)
		{
			object.position.y = y + 1;
		}
	}

	/*
	* Helper method to remove temporary objects e.g. the cursor hover object
	*/
	ClearTemporaryObjects()
	{
		if (this.cursorMesh)
		{
			this.scene.remove(this.cursorMesh);
		}
	}

	/*
	* Function to maintain a rendering loop.
	* @Param time The time value provided by requestAnimationFrame
	*/
	Render(time)
	{
		// Clear the cursor mesh if it exists
		this.ClearTemporaryObjects();

		// Convert time to seconds and then half
		time *= 0.001;
		time *= 0.5;

		// Check if resizing is required
		if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight)
		{
			this.ResizeDisplay();
		}
		
		this.html.MoveLabel();
		this.pickHelper.ClearObjects();
		this.pickHelper.PickClickedObject(this.pickPosition, this.camera, this.mouseClicked, this.activeSelectType);
		this.pickHelper.PickHoveredObject(this.pickPosition, this.camera);
		this.mouseClicked = false;

		// Render the current frame and calculate the next frame
		this.renderer.render(this.scene, this.camera);	
		requestAnimationFrame(this.render);
	}

	/*
	* Initiates the render loop.
	*/
	BeginRendering()
	{
		// Begin rendering loop
		requestAnimationFrame(this.render);
	}

	/*
	* Binds event listeners to DOM objects.
	*/
	InitialiseEventListeners()
	{
		this.canvas.addEventListener('mousemove', SetPickPosition);
		this.canvas.addEventListener( 'mousedown', SetClick, false );

		let selectButton = document.getElementById("button_select");
		let addButton = document.getElementById("button_add");
		let deleteButton = document.getElementById("button_delete");
		let characterButton = document.getElementById("button_character");
		let saveButton = document.getElementById("button_save");
		let hiddenButton = document.getElementById("button_hiddenblocks");

		if (selectButton) selectButton.addEventListener("click", function()
		{
			this.activeSelectType = SelectTypes.SELECT;
			this.html.RemoveLabels();
			SetButtonBorder();

		}.bind(this));

		if (addButton) addButton.addEventListener("click", function()
		{
			this.activeSelectType = SelectTypes.ADD;
			this.html.RemoveLabels();
			this.html.AddDrawMenu(true);
			SetButtonBorder();

		}.bind(this));

		if (deleteButton) deleteButton.addEventListener("click", function()
		{
			this.activeSelectType = SelectTypes.REMOVE;
			this.html.RemoveLabels();
			this.html.AddDrawMenu(false);
			SetButtonBorder();

		}.bind(this));

		if (characterButton) characterButton.addEventListener("click", function()
		{
			this.activeSelectType = SelectTypes.CHARACTER;
			this.html.RemoveLabels();
			SetButtonBorder();

		}.bind(this));
    
    	if (hiddenButton) hiddenButton.addEventListener("click", function()
		{
			this.activeSelectType = SelectTypes.HIDDEN_REGION;
			this.html.RemoveLabels();
			this.html.AddHiddenRegionMenu(this.mapMatrix.hiddenRegions);
			SetButtonBorder();

		}.bind(this));

		if (saveButton) saveButton.addEventListener("click", function()
		{
			this.SaveMap();
			SetButtonBorder();

		}.bind(this));
	}
}

var screen = new MapScreen();

// External event handlers and listeners

/*
* Gets the mouse position relative to the canvas.
* @Param event Event object with position values.
*/
function GetCanvasRelativePosition(event)
{
	const rect = screen.canvas.getBoundingClientRect();
	
	const xValue = event.clientX - rect.left;
	const yValue = event.clientY - rect.top;
	
	json = { x: xValue, y: yValue };
	return (json);
}

/*
* Sets the pick position for the InstancedObjectPicker to use.
* @Param event Event object to retrieve mouse position relative to the canvas.
*/
function SetPickPosition(event) 
{
	const pos = GetCanvasRelativePosition(event);
	screen.pickPosition.x = (pos.x / screen.canvas.clientWidth ) *  2 - 1;
	screen.pickPosition.y = (pos.y / screen.canvas.clientHeight) * -2 + 1;
}

/*
* Sets a variable to define if the mouse was clicked.
* @Param event Event object that contains the clicked button.
*/
function SetClick(event)
{
	if (event.button == 0)
	{
		screen.mouseClicked = true;
	}
}

function SetButtonBorder()
{
	let selectButton = document.getElementById("button_select");
	let addButton = document.getElementById("button_add");
	let deleteButton = document.getElementById("button_delete");
	let characterButton = document.getElementById("button_character");
	let hiddenButton = document.getElementById("button_hiddenblocks");

	if (selectButton) selectButton.classList.toggle('active_button', false);
	if (addButton) addButton.classList.toggle('active_button', false);
	if (deleteButton) deleteButton.classList.toggle('active_button', false);
	if (characterButton) characterButton.classList.toggle('active_button', false);
 	if (hiddenButton) hiddenButton.classList.toggle('active_button', false);

	switch(screen.activeSelectType)
	{
		case SelectTypes.SELECT:
			if (selectButton) selectButton.classList.toggle('active_button', true);
			break;
		case SelectTypes.ADD:
			if (addButton) addButton.classList.toggle('active_button', true);
			break;
		case SelectTypes.REMOVE:
			if (deleteButton) deleteButton.classList.toggle('active_button', true);
			break;
		case SelectTypes.CHARACTER:
			if (characterButton) characterButton.classList.toggle('active_button', true);
			break;
		case SelectTypes.HIDDEN_REGION:
			hiddenButton.classList.toggle('active_button', true);
		default:
			break;
	}
}