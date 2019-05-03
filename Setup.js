var programInfoMain;
var programInfoCam;
var programInfoGen;
var programInfoRefresh;

var tex1;
var fbo_1;
var tex2;
var fbo_2;


var saveTex;
var gridTex;

var image;

var phase = -1;
var frameCount = 0;
var now;
var lastTime = 0;
var elapsedTime = 0;
var iteration = 0;

const camSpeed = 0.03;
const zoomSpeed = 0.36;
const maxZoom = 8.;

var camZoom = 1.5;
var camLoc = [0.5, 0.5];
var camVel = [0., 0.];

var iteration = 0;

var speed = 1;

var isMouseHeldDown = false;
var emptyGridTex;

var isIterating;
var isRendering;
var shouldRefresh = true;

var is1Empty = true;
var is2Empty = true;
var SHOULD_FLIP = false;
var GRID_SIZE = 8;

//Set up user-controlled variables according to their values in the html file
var ITERS_PER_SECOND = parseInt(document.getElementById("Updates_Output").value, 10);
var SHOULD_WRAP = document.getElementsByName("Boundary_Mode")[0].checked;
var SELECTION_RULE = constructSelectionRule(true);
console.log(SELECTION_RULE);
var PREVIOUS_B_INPUT = document.getElementById("birthInput").value;
var PREVIOUS_S_INPUT = document.getElementById("surviveInput").value;

var CANVAS_SIZE_X = document.getElementById("canvas_1").width;
var CANVAS_SIZE_Y = document.getElementById("canvas_1").height;
var LIVE_COLOR = [
  parseInt(document.getElementById("redSliderT").value, 10)/255,
  parseInt(document.getElementById("greenSliderT").value, 10)/255,
  parseInt(document.getElementById("blueSliderT").value, 10)/255,
  1.
  ];
var IS_PAUSED = document.getElementById("PauseButton").value == "Run";

class ShaderProgramHolder {
  constructor() {
    this.main = null;
    this.cam = null;
    this.gen = null;
    this.refresh = null;
    this.random=null;
  }
};

var ShadersFinishedLoading = false;

var SHADERS = [
    "main",
    "cam",
    "gen",
    "refresh",
    "random"
];

var Shader = new ShaderProgramHolder();


//Helper function that builds the shader program when given a source file
function InitializeShader(gl, source_vs, source_frag, fv, ff) {
    ErrorMessage = "Initializing Shader Program: <" + fv + ">, <" + ff + ">";

    var shader_vs = gl.createShader(gl.VERTEX_SHADER);
    var shader_frag = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(shader_vs, source_vs);
    gl.shaderSource(shader_frag, source_frag);

    gl.compileShader(shader_vs);
    gl.compileShader(shader_frag);

    var error = false;

    // Compile vertex shader
    if (!gl.getShaderParameter(shader_vs, gl.COMPILE_STATUS)) {
        ErrorMessage += gl.getShaderInfoLog(shader_vs);
        error = true;
    }

    // Compile fragment shader
    if (!gl.getShaderParameter(shader_frag, gl.COMPILE_STATUS)) {
        ErrorMessage += gl.getShaderInfoLog(shader_frag);
        error = true;
    }

    // Create shader program consisting of shader pair
    program = gl.createProgram();

    var ret = gl.getProgramInfoLog(program);

    if (ret != "")
        ErrorMessage += ret;

    // Attach shaders to the program; these methods do not have a return value
    gl.attachShader(program, shader_vs);
    gl.attachShader(program, shader_frag);

    // Link the program - returns 0 if an error occurs
    if (gl.linkProgram(program) == 0) {
        ErrorMessage += "\r\ngl.linkProgram(program) failed with error code 0.";
        error = true;
    }

    if (error)  {
        console.log(ErrorMessage + ' ...failed to initialize shader.');
        return false;
    } else {
        console.log(ErrorMessage + ' ...shader successfully created.');
        return program; // Return created program
    }
}

//Load externally sourced shaders by grabbing their file contents and passing them
//to the InitializeShader() method
function LoadShader(gl, shaderName, filenameVertexShader, filenameFragmentShader, index)
{
    var ShaderDirectory = "shaders";

    var filename_vs = ShaderDirectory + "/" + filenameVertexShader;
    var filename_fs = ShaderDirectory + "/" + filenameFragmentShader;

    var v = "";
    var f = "";
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = function() {
        if (xmlhttp.readyState == XMLHttpRequest.DONE) {
            if (xmlhttp.status == 200) {

                v = xmlhttp.responseText;

                var xmlhttp2 = new XMLHttpRequest();
                xmlhttp2.onreadystatechange = function () {
                    if (xmlhttp2.readyState == XMLHttpRequest.DONE)
                        if (xmlhttp2.status == 200) {

                            f = xmlhttp2.responseText;

                            console.log(shaderName);

                            Shader [shaderName] = InitializeShader(gl, v, f, filenameVertexShader, filenameFragmentShader);
                            console.log(Shader[shaderName]);
                            if (index == SHADERS.length - 1) {
                              //Wait for asynchronous loading to complete before beginning initialization
                                setTimeout(function () {
                                    ShadersFinishedLoading = true;
                                    startIterLoop();
                                }, 500);
                            }
                        }
                };
                xmlhttp2.open("GET", filename_fs, true);
                xmlhttp2.send();
            }
        }
    };
    xmlhttp.open("GET", filename_vs, true);
    xmlhttp.send();
}



//Build a generic texture
function generateTex(data, width, height) {
  const targetTextureWidth = width;
  const targetTextureHeight = height;
  const targetTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, targetTexture);

  const level = 0;
  const internalFormat = gl.RGBA;
  const border = 0;
  const format = gl.RGBA;
  const type = gl.UNSIGNED_BYTE;
  const alignment = 1;
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);

  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    targetTextureWidth, targetTextureHeight, border,
                    format, type, data);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  return targetTexture;
}

function generateFrameBuffer(tex, level) {
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, level);
  return fb;
}

//Generates the backing textures, fbos, and most of the shader programs
//before beginning rener loop initialization
function startIterLoop() {
  programInfoMain = {
      program: Shader["main"],
      attribLocations: {
        vertexPosition: gl.getAttribLocation(Shader["main"], 'position'),
      },
      uniformLocations: {
        liveColor: gl.getUniformLocation(Shader["main"], 'liveColor'),
        gridSize: gl.getUniformLocation(Shader["main"], 'gridSize'),
        shouldWrap: gl.getUniformLocation(Shader["main"], 'shouldWrap'),
        selectionRule: gl.getUniformLocation(Shader["main"], 'selectionRule')
      },
  };

  canvas.width  = CANVAS_SIZE_X;
  canvas.height = CANVAS_SIZE_Y;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.useProgram(Shader["main"]);


  var emptyGrid = genGridData(CANVAS_SIZE_X, CANVAS_SIZE_Y, 0, true);
  emptyGridTex = generateTex(emptyGrid, CANVAS_SIZE_X, CANVAS_SIZE_Y);

  tex1 = generateTex(null, CANVAS_SIZE_X, CANVAS_SIZE_Y);
  fbo_1 = generateFrameBuffer(tex1, 0);

  tex2 = emptyGridTex;
  fbo_2 = generateFrameBuffer(emptyGridTex, 0);

  saveTex = generateTex(null, CANVAS_SIZE_X, CANVAS_SIZE_Y);
  fboSave = generateFrameBuffer(saveTex, 0);

  var c = 1.
  var mainArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, mainArrayBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -c, -c,
      c, -c,
      -c,  c,
      -c,  c,
      c, -c,
      c,  c]),
    gl.STATIC_DRAW
  );

  programInfoGen = {
    program: Shader["gen"],
    attribLocations: {
      vertexPosition: gl.getAttribLocation(Shader["gen"], 'position'),
    },
    uniformLocations: {
      setColor: gl.getUniformLocation(Shader["gen"], 'setColor'),
      startCoord: gl.getUniformLocation(Shader["gen"], 'startCoord'),
      gridSize: gl.getUniformLocation(Shader["gen"], 'gridSize')
    },
  };

  gl.useProgram(Shader["gen"]);
  var genArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, genArrayBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -c, -c,
      c, -c,
      -c,  c,
      -c,  c,
      c, -c,
      c,  c]),
    gl.STATIC_DRAW
  );


  programInfoRefresh = {
    program: Shader["refresh"],
    attribLocations: {
      vertexPosition: gl.getAttribLocation(Shader["refresh"], 'position'),
    },
    uniformLocations: {
      liveColor: gl.getUniformLocation(Shader["refresh"], 'liveColor'),
      shouldFlip: gl.getUniformLocation(Shader["refresh"], 'shouldFlip')
    },
  };
  gl.useProgram(Shader["refresh"]);
  var refreshArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, refreshArrayBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -c, -c,
      c, -c,
      -c,  c,
      -c,  c,
      c, -c,
      c,  c]),
    gl.STATIC_DRAW
  );

  programInfoRandom = {
    program: Shader["random"],
    attribLocations: {
      vertexPosition: gl.getAttribLocation(Shader["random"], 'position'),
    },
    uniformLocations: {
      liveColor: gl.getUniformLocation(Shader["random"], 'liveColor'),
      gridSize: gl.getUniformLocation(Shader["random"], 'gridSize'),
      randSeed: gl.getUniformLocation(Shader["random"], 'randSeed')
    },
  };
  gl.useProgram(Shader["random"]);
  var randomArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, randomArrayBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -c, -c,
      c, -c,
      -c,  c,
      -c,  c,
      c, -c,
      c,  c]),
    gl.STATIC_DRAW
  );
  //setup the display quickly now that everything's loaded
  startRenderLoop();
  timeStep();
}

//Generates a grid with the given spacing
function genGridData(size_X, size_Y, spacing, isEmpty) {
  var out = new Uint8Array(size_X * size_Y * 4);
  var i;
  var j;
  var counter = 0;
  var row = 0;
  var add;
  var c = 255
  if (!isEmpty) {
    for (i=0; i < out.length; ++i) {
      add = 4 * size_X * row;
      if (counter % (4 * GRID_SIZE) == 0) {
        out[add + counter] = c;
        out[add + counter + 1] = c;
        out[add + counter + 2] = c;
        out[add + counter + 3] = c;
      }
      if (row % GRID_SIZE == 0) {
        out[add + counter] = c;
        out[add + counter + 1] = c;
        out[add + counter + 2] = c;
        out[add + counter + 3] = c;
      }
      counter++;
      if (counter > 4 * size_X) {
        counter = 0;
        row++;
      }
    }
  } else {
    for (i=0; i < out.length; i+=4) {
      out[i] = 0.;
      out[i+1] = 0.;
      out[i+2] = 0.;
      out[i+3] = 1.;
    }
  }
  return out;
}

//Sets up the camera shader program, the grid, and activates the render loop
function startRenderLoop() {
  programInfoCam = {
      program: Shader["cam"],
      attribLocations: {
        vertexPosition: gl.getAttribLocation(Shader["cam"], 'position'),
      },
      uniformLocations: {
        screenWidth: gl.getUniformLocation(Shader["cam"], 'screenWidth'),
        screenHeight: gl.getUniformLocation(Shader["cam"], 'screenHeight'),
        center: gl.getUniformLocation(Shader["cam"], 'center'),
        zoom: gl.getUniformLocation(Shader["cam"], 'zoom')
      },
  };

  var c = 1.;

  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  gl.useProgram(Shader["cam"]);

  var dat = genGridData(CANVAS_SIZE_X, CANVAS_SIZE_Y, GRID_SIZE, false);
  gridTex = generateTex(dat, CANVAS_SIZE_X, CANVAS_SIZE_Y);

  camArrayBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, camArrayBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
    -c, -c,
    c, -c,
    -c,  c,
    -c,  c,
    c, -c,
    c,  c]),
    gl.STATIC_DRAW
  );
  render();

}

// Scroll through the list, loading shader pairs
function CreateShadersFromFile( gl ) {
    for (i in SHADERS)
        LoadShader(gl, SHADERS[i], SHADERS[i] + ".vert", SHADERS[i] + ".frag",
            i // pass in the index of the currently loading shader,
              // this way we can determine when last shader has finished loading
        );
}

//Helper function to run arbitrary shader drawing to the given framebuffer from
//the given texture
function drawFrame(destFramebuffer, boundTexture, shouldClear) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, destFramebuffer);
  gl.bindTexture(gl.TEXTURE_2D, boundTexture);

  //Should we clear the existing data or draw on top of it?
  if (shouldClear) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  //Render the quad across the whole screen
  gl.drawArrays(gl.TRIANGLES, 0, 6);

}

//Helper function to switch to a new shader program using the shaderInfo struct
function switchShaderProgram(newInfo) {
  //Disable old array
  gl.enableVertexAttribArray(0);
  gl.useProgram(newInfo.program);
  gl.enableVertexAttribArray(newInfo.attribLocations.vertexPosition);
  gl.vertexAttribPointer(newInfo.attribLocations[0], 2, gl.FLOAT, false, 0, 0);
}

//Performs one timstep of the running simulation if unpaused; will wait
//the user-specified amount of time to run the next step
function timeStep() {
  if (!IS_PAUSED) {
    setTimeout(function () {
      timeStep();
    }, 1000/ITERS_PER_SECOND);

    isIterating = true;

    switchShaderProgram(programInfoMain);
    gl.uniform4f(programInfoMain.uniformLocations.liveColor,
      LIVE_COLOR[0], LIVE_COLOR[1], LIVE_COLOR[2], LIVE_COLOR[3]);
    gl.uniform1i(programInfoMain.uniformLocations.gridSize, GRID_SIZE);
    gl.uniform1i(programInfoMain.uniformLocations.shouldWrap, SHOULD_WRAP);
    gl.uniform1iv(programInfoMain.uniformLocations.selectionRule, SELECTION_RULE);

    for (i=0; i<speed; ++i) {
      phase = -1 * phase;
      if (phase == 1) {
        //Render from tex2 to tex1 with the compute shader, completing one iteration
        drawFrame(fbo_1, tex2, true);
      }
      if (phase == -1) {
        //Now render from tex1 from tex2, performing the second iteration
        drawFrame(fbo_2, tex1, true);
      }
    }
    iteration++;
    document.getElementById("Iterations_Output").value = iteration;
    isIterating = false;
  }
}

//Move the camera by the given amount while respecting the boundaries of the canvas
function applyCameraMovement() {
    var extremeVal = 1/(2 * camZoom);

    var i;
    for(i=0; i<2; i++) {
      camLoc[i] += camVel[i] * camSpeed/camZoom;
      if (camLoc[i] < extremeVal) {
        camLoc[i] = extremeVal;
      }
      if (camLoc[i] > 1 - extremeVal) {
        camLoc[i] = 1 - extremeVal;
      }
    }
}

//Update the existing shaders with a new color
function colorRefresh(color, sFlip) {
  switchShaderProgram(programInfoRefresh);
  gl.uniform4f(programInfoRefresh.uniformLocations.liveColor,
    color[0], color[1], color[2], color[3]);
  gl.uniform1i(programInfoRefresh.uniformLocations.shouldFlip, sFlip);

  drawFrame(fbo_1, tex2, true);
  drawFrame(fbo_2, tex1, true);
}

//Renders the data in the active fbo to the grid; does NOT timestep the sim
//Will run at the maximum rate it's allowed to by the browser
function render() {

  window.requestAnimationFrame(render, canvas);

  isRendering = true;

  //Avoid race conditions during refresh by not refreshing during a physics
  //timestep and accidentally overwriting the fbo's
  if (shouldRefresh && !isIterating) {
    //Don't totally delete everything if the user decides to go to 0/0/0 color
    //for some reason
    if (LIVE_COLOR[0] + LIVE_COLOR[1] + LIVE_COLOR[2] == 0) {
      LIVE_COLOR[1] = 1/255;
    }
    colorRefresh(LIVE_COLOR, SHOULD_FLIP);
    SHOULD_FLIP = false;
    shouldRefresh = false;
  }

  //Move the camera the amount specified by the current user input
  applyCameraMovement();

  switchShaderProgram(programInfoCam);
  gl.uniform1f(programInfoCam.uniformLocations.screenWidth, canvas.width);
  gl.uniform1f(programInfoCam.uniformLocations.screenHeight, canvas.height);

  gl.uniform2f(programInfoCam.uniformLocations.center, camLoc[0], camLoc[1]);
  gl.uniform1f(programInfoCam.uniformLocations.zoom, camZoom);


  //Draw the data and then the grid overlay to the canvas
  if (phase == 1) {
    drawFrame(null, tex1, true);
    drawFrame(null, gridTex, false);
  }

  if(phase == -1) {
    drawFrame(null, tex2, true);
    drawFrame(null, gridTex, false);
  }

  //Measure our current fps by tracking the time between frames
  now = new Date().getTime();

  frameCount += 1;
  if (iteration == 0) {
    elapsedTime = 0;
  } else {
    elapsedTime += (now - lastTime);
  }

  if (elapsedTime >= 1000) {
      fps = frameCount;
      frameCount = 0;
      elapsedTime -= 1000;
      document.getElementById("FPS_Output").value = fps;
  }

  lastTime = now;

  isRendering = false;
}

//Maps from mouse pixel values on click to the space of the fbo textures
//for painting the grid
function convertCanvasCoords(x, y) {
  if (x > CANVAS_SIZE_X) {
      x = CANVAS_SIZE_X;
  }

  if (y > CANVAS_SIZE_Y) {
      y = CANVAS_SIZE_Y;
  }

  y = CANVAS_SIZE_Y - y;

  var centerX = camLoc[0] * CANVAS_SIZE_X;
  var centerY = camLoc[1] * CANVAS_SIZE_Y;

  var trueX = (x - 0.5 * CANVAS_SIZE_X)/camZoom + centerX;
  var trueY = (y - 0.5 * CANVAS_SIZE_Y)/camZoom + centerY;

  trueX = Math.floor(trueX - (trueX % GRID_SIZE));
  trueY = Math.floor(trueY - (trueY % GRID_SIZE));

  return [trueX, trueY];
}

//Called to fill one grid slot starting at startCoord with the specified color
function genPixels(startCoord, color) {
  switchShaderProgram(programInfoGen);
  gl.uniform1i(programInfoGen.uniformLocations.gridSize, GRID_SIZE);
  gl.uniform2i(programInfoGen.uniformLocations.startCoord, startCoord[0], startCoord[1]);
  gl.uniform4f(programInfoGen.uniformLocations.setColor, color[0], color[1], color[2], color[3]);


  if (phase == -1) {
    drawFrame(fbo_1, tex2, true);
    drawFrame(fbo_2, tex1, true);
  } else {
    drawFrame(fbo_2, tex1, true);
    drawFrame(fbo_1, tex2, true);
  }

  is1Empty = false;
  is2Empty = false;
}

//Fills the entire grid with a random arrangement of dead/alive pixels
function genRandom(color) {
  switchShaderProgram(programInfoRandom);
  gl.uniform1i(programInfoRandom.uniformLocations.gridSize, GRID_SIZE);
  gl.uniform4f(programInfoRandom.uniformLocations.liveColor, color[0], color[1], color[2], color[3]);
  //Avoid zero as that would result in the entire grid being the same color
  var rand = Math.random() + 0.1;
  gl.uniform1f(programInfoRandom.uniformLocations.randSeed, rand);

  if (phase == -1) {
    drawFrame(fbo_1, tex2, true);
    drawFrame(fbo_2, tex1, true);
  } else {
    drawFrame(fbo_2, tex1, true);
    drawFrame(fbo_1, tex2, true);
  }
}


//Returns an array consisting of the common elements of array1 and array2
function arrayIntersect(array1, array2) {
    var holder;
    if (array2.length > array1.length) {
      holder = array2;
      array2 = array1;
      array1 = holder;
    }
    return array1.filter(function (e) {
        return array2.indexOf(e) > -1;
    });
}

function SelectionRuleException(message) {
  this.message = message;
  this.name = 'SelectionRuleException';
}

//This function automatically rejects invalid selection rules
//or applies valid ones
function constructSelectionRule(isFirst) {
  var newRule = new Int32Array(9);
  var a;
  //Cells will die by default unless overwritten later
  for (a = 0; a < 9; ++a) {
    newRule[a] = -1;
  }

  var val;

  var bSource = document.getElementById("birthInput");
  var sSource = document.getElementById("surviveInput");

  var B_vals = bSource.value.replace(' ', '').split(",");
  var S_vals = sSource.value.replace(' ', '').split(",");

  var convertedBVals = [];
  var convertedSVals = [];

  var i;
  for (i = 0; i < B_vals.length; ++i) {
    val = parseInt(B_vals[i], 10);

    if (val == NaN || val < 0 || val > 8) {
      if (!isFirst) {
        //Reset to the previous input (and thus reject the new one)
        bSource.value = PREVIOUS_B_INPUT;
        dSource.value = PREVIOUS_S_INPUT;
      } else {
        //If this exception is thrown there's something wrong with the HTML
        //page's initial values
        throw new SelectionRuleException('Cannot parse rule');
      }
      //Exit immediately with old rule
      return SELECTION_RULE;
    }

    convertedBVals.push(val);
  }

  for (i = 0; i < S_vals.length; ++i) {
    val = parseInt(S_vals[i], 10);

    if (val == NaN || val < 0 || val > 8) {
      if (!isFirst) {
        bSource.value = PREVIOUS_B_INPUT;
        dSource.value = PREVIOUS_S_INPUT;
      } else {
        throw new SelectionRuleException('Cannot parse rule');
      }
      return SELECTION_RULE;
    }

    convertedSVals.push(val);
  }

  var overlap = arrayIntersect(convertedBVals, convertedSVals);

  var k;
  for (k=0; k < convertedBVals.length; ++k) {
    newRule[convertedBVals[k]] = 1;
  }
  var l;
  for (l=0; l < convertedSVals.length; ++l) {
    newRule[convertedSVals[l]] = 0;
  }

  var m;
  for (m=0; m < overlap.length; ++m) {
    newRule[overlap[m]] = 2;
  }

  PREVIOUS_B_INPUT = bSource.value;
  PREVIOUS_S_INPUT = sSource.value;
  return newRule;
}

function resetGrid(newGridTex) {
  iteration = 0;
  document.getElementById("Iterations_Output").value = iteration;
  switchShaderProgram(programInfoRefresh);
  gl.uniform4f(programInfoRefresh.uniformLocations.liveColor,
    LIVE_COLOR[0], LIVE_COLOR[1], LIVE_COLOR[2], LIVE_COLOR[3]);
  gl.uniform1i(programInfoRefresh.uniformLocations.shouldFlip, false);
  phase = -1;
  drawFrame(fbo_1, newGridTex, true);
  drawFrame(fbo_2, newGridTex, true);
}

function init() {
    canvas = document.getElementById("canvas_1");
    gl = canvas.getContext("webgl2");

    // Only continue if WebGL is available and working
    if (gl === null) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    CreateShadersFromFile(gl);

    window.addEventListener("keydown", function(event)
      {
        //f
        if (event.which == 70) {
          camVel[0] = 1.;
          //console.log(camLoc[0]);
        }
        //a
        if (event.which == 65) {
          camVel[0] = -1.;
        }
        //w
        if (event.which == 87) {
          camVel[1] = 1.;
        }
        //s
        if (event.which == 83) {
          camVel[1] = -1.;
        }

        //,
        if (event.which == 188) {
          ITERS_PER_SECOND -= 4;
          if (ITERS_PER_SECOND < 1) {
            ITERS_PER_SECOND = 1;
          }
          document.getElementById("Updates_Output").value = ITERS_PER_SECOND;
        }

        //.
        if (event.which == 190) {
          ITERS_PER_SECOND += 4;
          if (ITERS_PER_SECOND > 60) {
            ITERS_PER_SECOND = 60;
          }
          document.getElementById("Updates_Output").value = ITERS_PER_SECOND;
        }

        //p
        if (event.which == 80) {
          document.getElementById("PauseButton").value = IS_PAUSED ? "Pause" : "Run";
          IS_PAUSED = !IS_PAUSED;
          if (!IS_PAUSED) {
            if (iteration == 0) {
              //Copy the texture contents to a holder fbo
              switchShaderProgram(programInfoRefresh);
              gl.uniform4f(programInfoRefresh.uniformLocations.liveColor,
                LIVE_COLOR[0], LIVE_COLOR[1], LIVE_COLOR[2], LIVE_COLOR[3]);
              gl.uniform1i(programInfoRefresh.uniformLocations.shouldFlip, false);
              drawFrame(fboSave, (phase == -1) ? tex1 : tex2, true);
            }
            timeStep();
          }
        }

        //r
        if (event.which == 82) {
          resetGrid(saveTex);
        }

        //delete
        if (event.which == 46) {
          colorRefresh([0., 0., 0., 1]);
          iteration = 0;
          document.getElementById("Iterations_Output").value = iteration;
          IS_PAUSED = true;
          document.getElementById("PauseButton").value = "Run";

        }
      }
    );

    document.getElementById("randomizeButton").addEventListener("click",
      function(event) {
        iteration = 0;
        phase = -1;
        genRandom(LIVE_COLOR);
      }
    );

    document.getElementById("redSliderT").addEventListener("change",
      function(event) {
        var val = parseFloat(this.value);
        val = Math.round(val);
        this.value = val;
        if (val > 255) {
          val = 255;
          this.value = 255;
        }
        if (val < 0) {
          val = 0;
          this.value = 0;
        }
        LIVE_COLOR[0] = val/255;
        shouldRefresh = true;
      }
    );

    document.getElementById("birthInput").addEventListener("change",
      function(event) {
        SELECTION_RULE = constructSelectionRule(false);
      }
    );

    document.getElementById("surviveInput").addEventListener("change",
      function(event) {
        SELECTION_RULE = constructSelectionRule(false);
      }
    );


    document.getElementById("greenSliderT").addEventListener("change",
      function(event) {
        var val = parseFloat(this.value);
        val = Math.round(val);
        this.value = val;
        if (val > 255) {
          val = 255;
          this.value = 255;
        }
        if (val < 0) {
          val = 0;
          this.value = 0;
        }
        LIVE_COLOR[1] = val/255;
        shouldRefresh = true;
      }
    );

    document.getElementById("blueSliderT").addEventListener("change",
      function(event) {
        var val = parseFloat(this.value);
        val = Math.round(val);
        this.value = val;
        if (val > 255) {
          val = 255;
          this.value = 255;
        }
        if (val < 0) {
          val = 0;
          this.value = 0;
        }
        LIVE_COLOR[2] = val/255;
        shouldRefresh = true;
      }
    );

    var radios = document.getElementsByName("Boundary_Mode");
    var i;
    for (i = 0; i < radios.length; ++i) {
      radios[i].addEventListener("change",
        function(event) {
          if (this.checked) {
            SHOULD_WRAP = this.value == 'p';
          }
        }
      )
    }

    document.getElementById("PauseButton").addEventListener("click",
      function(event) {
        this.value = IS_PAUSED ? "Pause" : "Run";
        IS_PAUSED = !IS_PAUSED;
        if (!IS_PAUSED) {
            if (iteration == 0) {
              //Copy the texture contents to a holder fbo
              switchShaderProgram(programInfoRefresh);
              gl.uniform4f(programInfoRefresh.uniformLocations.liveColor,
                color[0], color[1], color[2], color[3]);
              gl.uniform1i(programInfoRefresh.uniformLocations.shouldFlip, sFlip);
              drawFrame(fboSave, (phase == -1) ? tex2 : tex1, true);
            }
            timeStep();
        }
      }
    );

    document.getElementById("importButton").addEventListener("click",
      function(event) {
        document.getElementById("importInput").dispatchEvent(new Event("click"));
      }
    );

    document.getElementById("importInput").addEventListener("input",
      function(event) {
        //Exit if import is canceled
        if (document.getElementById("importInput").files.length == 0) {
          return;
        }
        var file = document.getElementById("importInput").files[0];
        var reader = new FileReader();
        var image = new Image();

        image.onload = function() {
          var imageTex = generateTex(image, CANVAS_SIZE_X, CANVAS_SIZE_Y);
          resetGrid(imageTex);
          shouldRefresh = true;
        }

        reader.addEventListener("load", function () {
          image.src = reader.result;
        }, false);

        reader.readAsDataURL(file);
      }
    );

    document.getElementById("saveButton").addEventListener("click",
      function(event) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, (phase==-1) ? fbo_2 : fbo_1);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, (phase==-1) ? tex2 : tex1 , 0);
        var data = new Uint8Array(CANVAS_SIZE_X * CANVAS_SIZE_Y * 4);
        gl.readPixels(0, 0, CANVAS_SIZE_X, CANVAS_SIZE_Y, gl.RGBA, gl.UNSIGNED_BYTE, data);

        var canvas = document.createElement('canvas');
        canvas.setAttribute("id", "c2");
        canvas.width = CANVAS_SIZE_X;
        canvas.height = CANVAS_SIZE_Y;
        var context = canvas.getContext('2d');

        var imageData = context.createImageData(CANVAS_SIZE_X, CANVAS_SIZE_Y);
        imageData.data.set(data);
        context.putImageData(imageData, 0, 0);

        var name = document.getElementById('nameInput').value.replace(' ', '');

        var link = document.getElementById('link');
        link.setAttribute('download', name + '.png');
        link.setAttribute('href', canvas.toDataURL("image/png").replace("image/png", "image/octet-stream"));
        link.click();
      }
    );

    document.getElementById("Updates_Output").addEventListener("change",
      function(event) {

        this.value = Math.round(this.value);
        if (this.value > 60) {
          this.value = 60;
        }
        if (this.value < 1) {
          this.value = 1;
        }
        ITERS_PER_SECOND = this.value;
      }
    );

    canvas.addEventListener("mousedown",
      function(event) {
        isMouseHeldDown = true;
        var rect = canvas.getBoundingClientRect();
        var x =  (event.clientX - rect.left) / (rect.right - rect.left) * CANVAS_SIZE_X;
        var y = (event.clientY - rect.top) / (rect.bottom - rect.top) * CANVAS_SIZE_Y;
        var realCoords = convertCanvasCoords(x, y);
        if (!event.shiftKey) {
          genPixels(realCoords, LIVE_COLOR);
        } else {
          genPixels(realCoords, [0., 0., 0., 1.]);
        }
      }
    );


    canvas.addEventListener("mousemove",
      function(event) {
        if (isMouseHeldDown) {
          var rect = canvas.getBoundingClientRect();
          var x =  (event.clientX - rect.left) / (rect.right - rect.left) * CANVAS_SIZE_X;
          var y = (event.clientY - rect.top) / (rect.bottom - rect.top) * CANVAS_SIZE_Y;
          var realCoords = convertCanvasCoords(x, y);
          if (!event.shiftKey) {
            genPixels(realCoords, LIVE_COLOR);
          } else {
            genPixels(realCoords, [0., 0., 0., 1.]);
          }
        }
      }
    );

    canvas.addEventListener("mouseup",
      function(event) {
        isMouseHeldDown = false;
      }
    );



    window.addEventListener("keyup", function(event)
      {
        //f
        if (event.which == 70) {
          if (camVel[0] == 1.) {
            camVel[0] = 0.;
          }
        }
        //a
        if (event.which == 65) {
          if (camVel[0] == -1.) {
            camVel[0] = 0.;
          }
        }
        //w
        if (event.which == 87) {
          if (camVel[1] ==  1.) {
            camVel[1] = 0.;
          }
        }
        //s
        if (event.which == 83) {
          if (camVel[1] ==  -1.) {
            camVel[1] = 0.;
          }
        }
      }
    );

    window.addEventListener("wheel", function(event)
      {
        var delta = Math.sign(event.deltaY);
        camZoom += -1 * delta * zoomSpeed;
        if (camZoom < 1.) {
          camZoom = 1.;
        }
        if (camZoom > maxZoom) {
          camZoom = maxZoom;
        }
      }
    );
}
window.onload = init;
