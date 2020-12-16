var settings = {}
var info = {}

var tank = {};

var loopFunctions = [];


function importScripts(script) 
{

}

tank.init = function(f) {

}

tank.loop = function(f) {
    loopFunctions.push(f);
}

Math.deg = {}
  Math.deg.normalize = function(angle) 
  {
    angle =  angle % 360; 
    // force it to be the positive remainder, so that 0 <= angle < 360  
    angle = (angle + 360) % 360;  

    // force into the minimum absolute value residue class, so that -180 < angle <= 180  
    if (angle > 180)  
      angle -= 360;
    return angle
  }
  
  
