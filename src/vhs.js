// vhs.js — the snuff-tape look. Desktop: the scene renders into a target and a
// full-screen pass smears it like worn VHS (colour bleed, tracking wobble,
// scanlines, grain, washed-out colour). VR: a cheap overlay in front of the
// eyes adds grain, scanlines, a rolling tracking band and vignette without an
// extra full-frame pass (which the Quest can't afford at 72-90 fps).
import * as THREE from '../vendor/three.module.js';

const GRAIN = `
  float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

export class VHS {
  constructor(renderer, camera) {
    this.renderer = renderer; this.camera = camera; this.amount = 1; this.hot = 0; this.hide = 0; this.t = 0;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace });
    this.quadScene = new THREE.Scene(); this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.pass = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.rt.texture }, t: { value: 0 }, amt: { value: 1 }, hot: { value: 0 }, hide: { value: 0 }, res: { value: size } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float t, amt, hot, hide; uniform vec2 res; varying vec2 vUv;
        ${GRAIN}
        void main(){
          vec2 uv = vUv;
          // tracking: whole lines jitter sideways, worse inside a slow rolling band
          float band = smoothstep(0.06, 0.0, abs(fract(uv.y * 0.6 - t * 0.07) - 0.5) - 0.42);
          float line = floor(uv.y * res.y / 2.0);
          uv.x += (hash(vec2(line, floor(t * 30.0))) - 0.5) * (0.0002 + band * 0.0025 + hot * 0.008) * amt;
          uv.x += sin(uv.y * 9.0 + t * 1.3) * 0.0002 * amt;
          // colour bleed: chroma smeared to the right, luma sharp-ish
          float off = (0.0009 + hot * 0.004) * amt;
          vec3 c;
          c.r = texture2D(tDiffuse, uv + vec2(off, 0.0)).r;
          c.g = texture2D(tDiffuse, uv).g;
          c.b = texture2D(tDiffuse, uv - vec2(off * 0.7, 0.0)).b;
          vec3 blur = (texture2D(tDiffuse, uv + vec2(off * 1.6, 0.0)).rgb + texture2D(tDiffuse, uv - vec2(off * 1.6, 0.0)).rgb) * 0.5;
          c = mix(c, blur, (0.12 + hot * 0.3) * amt);
          // tape colour: crushed saturation, a sick green-yellow cast (still linear here)
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, vec3(l), 0.18 * amt) * mix(vec3(1.0), vec3(1.04, 1.0, 0.88), amt);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          // everything below is in display space so grain doesn't get blown up by exposure
          vec3 d = gl_FragColor.rgb;
          d = d * (1.0 - 0.03 * amt) + 0.015 * amt;                                   // lifted tape blacks
          d *= 1.0 - (0.025 * amt) * step(0.5, fract(gl_FragCoord.y * 0.5));
          float g = (hash(floor(gl_FragCoord.xy / 1.6) + vec2(fract(t * 61.0) * 1000.0, fract(t * 37.0) * 1000.0)) - 0.5) * 0.7 + (hash(gl_FragCoord.xy + fract(t * 23.0) * 500.0) - 0.5) * 0.5;
          d += vec3(1.0, 0.95, 0.85) * g * (0.15 + hot * 0.05) * amt * (0.7 + 0.6 * (1.0 - dot(d, vec3(0.33))));
          float drop = step(0.9985 - band * 0.004, hash(vec2(floor(gl_FragCoord.y), floor(t * 24.0)))) * step(0.6, hash(vec2(floor(gl_FragCoord.x / 40.0), floor(t * 24.0))));
          d += drop * (0.08 + hot * 0.3) * amt + band * 0.008 * amt;
          vec2 q = vUv - 0.5; d *= 1.0 - dot(q, q) * (0.55 + hot * 0.6) * amt;
          // hidden in shadow: a touch darker
          d *= 1.0 - hide * 0.12; // hidden: just a touch darker, no colour change
          gl_FragColor = vec4(d, 1.0);
        }`,
      depthTest: false, depthWrite: false, toneMapped: true,
    });
    this.quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.pass));
    addEventListener('resize', () => this.resize());

    // VR overlay: a quad 12 cm in front of the eyes, wide enough to cover both
    this.overlay = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, amt: { value: 1 }, hot: { value: 0 }, hide: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float t, amt, hot, hide; varying vec2 vUv;
        ${GRAIN}
        void main(){
          float g = hash(floor(vUv * vec2(1000.0, 720.0)) + vec2(fract(t * 53.0) * 1000.0, fract(t * 29.0) * 1000.0));
          float scan = step(0.5, fract(vUv.y * 360.0));
          float band = smoothstep(0.05, 0.0, abs(fract(vUv.y * 0.6 - t * 0.07) - 0.5) - 0.44);
          vec2 q = vUv - 0.5; float vig = smoothstep(0.12, 0.42, dot(q, q));
          // darken: scanlines + vignette; lighten: grain specks + tracking band
          float dark = (scan * 0.012 + vig * (0.3 + hot * 0.3) + step(g, 0.25) * 0.035) * amt;
          float light = (step(0.75, g) * 0.035 + band * 0.01 + hot * step(0.97, g) * 0.08) * amt;
          vec4 o = vec4(mix(vec3(0.0), vec3(0.9, 0.86, 0.78), light / max(0.001, light + dark)), clamp(dark + light, 0.0, 0.85));
          gl_FragColor = o;
        }`,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    }));
    this.overlay.position.set(0, 0, -0.12); this.overlay.renderOrder = 2000; this.overlay.frustumCulled = false; this.overlay.visible = false;
    camera.add(this.overlay);
  }
  resize() { const s = this.renderer.getDrawingBufferSize(new THREE.Vector2()); this.rt.setSize(s.x, s.y); this.pass.uniforms.res.value.copy(s); }
  // hot: 0..1, pushes the effect during executions and hits
  update(dt) {
    this.t += dt; this.hot = Math.max(0, this.hot - dt * 0.8);
    for (const u of [this.pass.uniforms, this.overlay.material.uniforms]) { u.t.value = this.t; u.amt.value = this.amount; u.hot.value = this.hot; u.hide.value = this.hide; }
  }
  render(scene, camera) {
    const R = this.renderer;
    if (R.xr.isPresenting || this.amount <= 0) {
      this.overlay.visible = R.xr.isPresenting && this.amount > 0;
      R.render(scene, camera); return;
    }
    this.overlay.visible = false;
    R.setRenderTarget(this.rt); R.render(scene, camera);
    R.setRenderTarget(null); R.render(this.quadScene, this.quadCam);
  }
}
