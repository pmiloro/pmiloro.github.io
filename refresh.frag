#version 300 es
precision highp float;
precision highp int;

out vec4 outColor;

uniform vec4 liveColor;
uniform bool shouldFlip;

uniform sampler2D tex;

void main() {
    vec4 val;

    //Account for pixel 'misalignment' with grid since the bottom left corner
    //pixel is by default 0.5, 0.5, and WebGL doesn't seem to support
    //the pixel_center_integer redeclaration
    ivec2 scaledCoord = ivec2(int(gl_FragCoord.x - 0.5), int(gl_FragCoord.y - 0.5));

    if (shouldFlip) {
        ivec2 texSize = textureSize(tex, 0);
        scaledCoord = ivec2(scaledCoord.x, texSize.y - scaledCoord.y);
    }
    val = texelFetch(tex, scaledCoord, 0);
    float compareMag = ceil(dot(liveColor.xyz, liveColor.xyz)/3.);
    int self = int( ceil(dot(val.xyz, val.xyz)/3.) / compareMag );

    if (self == 1) {
        outColor = liveColor;
    } else {
        outColor = vec4(0., 0., 0., 1.);
    }
}
