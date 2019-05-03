#version 300 es
precision highp float;
precision highp int;

out vec4 outColor;

uniform int[9] selectionRule;

uniform bool shouldWrap;

uniform int gridSize;

uniform vec4 liveColor;

uniform sampler2D tex;

void main() {
    vec4 val;
    ivec2 modCoord;

    ivec2 scaledCoord = ivec2(int(gl_FragCoord.x - 0.5), int(gl_FragCoord.y - 0.5));
    ivec2 wrapSize = textureSize(tex, 0);

    float checkMag = ceil(dot(liveColor.xyz, liveColor.xyz)/3.);
    int sum = 0;

    val = texelFetch(tex, scaledCoord, 0);
    int self = int (ceil(dot(val.xyz, val.xyz)/3.) / checkMag);

    int g = gridSize;

    //iterate over nearest neighbors
    for(int i=-1; i<2;++i) {
        for (int j=-1; j<2; ++j) {
            if (abs(i) + abs(j) != 0) {
                //Wrap texture fetch for periodic boundary conditions
                if (shouldWrap) {
                    //Do inane casts to floats and back because glsl is poorly designed
                    //and has limited support for integer operations
                    modCoord = ivec2( int( mod( float( scaledCoord.x + i * g ), float( wrapSize.x) ) ),
                        int( mod( float( scaledCoord.y + j * g), float( wrapSize.y) ) ) );

                    //Use texelFetch() instead of texture() since we don't need filtering
                    val = texelFetch(tex, modCoord, 0);
                }
                else {
                    modCoord = ivec2(scaledCoord.x + i * g, scaledCoord.y + j * g);
                    if (modCoord.x >= wrapSize.x || modCoord.x < 0 || modCoord.y >= wrapSize.y || modCoord.y < 0) {
                        val = vec4(0., 0., 0., 1.);
                    } else {
                        val = texelFetch(tex, modCoord, 0);
                    }
                }

                sum += int (ceil(dot(val.xyz, val.xyz)/3.) / checkMag);
            }
        }
    }

    if (selectionRule[sum] == 0) {
        //Cell state remains whatever it was before the update, alive or dead
        outColor = texelFetch(tex, scaledCoord, 0);
    }

    if (selectionRule[sum] == 1) {
        //Edge case--cell is born if dead with this amount of neighbors,
        //but dies if alive
        if (self == 1) {
            outColor = vec4(0., 0., 0., 1.);
        } else {
            outColor = liveColor;
        }
    }

    if (selectionRule[sum] == 2) {
        //Cell will be alive no matter what, e.g., a dead cell is converted
        //to a live one and a living one remains alive
        outColor = liveColor;
    }

    if (selectionRule[sum] == -1) {
        //Cell dies no matter what/remains dead
        outColor = vec4(0., 0., 0., 1.);
    }

}
