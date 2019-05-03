#version 300 es
precision highp float ;
precision highp int ;


out vec4 outColor;

uniform int gridSize;
uniform vec4 liveColor;
uniform float randSeed;

uniform sampler2D tex;

//pseudoRandom 1-liner to replace something like glNoise, which apparently
//is not supported in webGL; copied from https://thebookofshaders.com/10/
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123);
}

void main() {
    vec2 baseCoord = vec2(gl_FragCoord.x - 0.5, gl_FragCoord.y - 0.5);
    float g = float(gridSize);
    //Generate a hash that will give every pixel in the same grid component the same random value
    baseCoord = vec2(floor(baseCoord.x/g) * g, floor(baseCoord.y/g) * g) * randSeed;

    //then use that value to check whether the cell will be dead or alive
    bool isAlive = int(round(random(baseCoord))) == 1;
    outColor = isAlive ? liveColor : vec4(0., 0., 0., 1.);
}
