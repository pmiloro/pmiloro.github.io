#version 300 es
precision highp float ;
precision highp int ;


out vec4 outColor;

uniform int gridSize;
uniform ivec2 startCoord;
uniform vec4 setColor;

uniform sampler2D tex;

void main() {
    ivec2 texelCoord = ivec2(int(gl_FragCoord.x - 0.5), int(gl_FragCoord.y - 0.5));
    //If the fragment is inside the bounding grid radius, apply the given outColor
    if ( (texelCoord.x >= startCoord.x  && texelCoord.x <= startCoord.x + (gridSize - 1) ) &&
        (texelCoord.y >= startCoord.y && texelCoord.y <= startCoord.y + (gridSize - 1) ) ) {
        outColor = setColor;
    } else {
        outColor = texelFetch(tex, texelCoord, 0);
    }
}
