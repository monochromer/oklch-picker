import {
  MeshBasicMaterial,
  PerspectiveCamera,
  BufferAttribute,
  BufferGeometry,
  PlaneGeometry,
  WebGLRenderer,
  DoubleSide,
  Renderer,
  Vector3,
  Camera,
  Scene,
  Mesh
} from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Delaunator from 'delaunator'

import { showP3, showRec2020 } from '../stores/settings.js'
import { oklch, lch, AnyRgb } from './colors.js'

let addCoordinate: (coordinates: Vector3[], rgb: AnyRgb) => void
if (LCH) {
  addCoordinate = (coordinates, rgb) => {
    let color = lch(rgb)
    coordinates.push(
      new Vector3(color.l / 100, color.c / 100, (color.h ?? 0) / 200)
    )
  }
} else {
  addCoordinate = (coordinates, rgb) => {
    let color = oklch(rgb)
    coordinates.push(new Vector3(color.l, color.c * 1.3, (color.h ?? 0) / 360))
  }
}

function getModelData(mode: 'rgb' | 'rec2020' | 'p3'): [Vector3[], number[]] {
  let coordinates: Vector3[] = []
  let colors: number[] = []

  for (let x = 0; x <= 1; x += 0.01) {
    for (let y = 0; y <= 1; y += 0.01) {
      for (let z = 0; z <= 1; z += 0.01) {
        let rgb: AnyRgb = { mode, r: x, g: y, b: z }
        if (
          rgb.r === 0 ||
          rgb.g === 0 ||
          rgb.b === 0 ||
          rgb.r > 0.99 ||
          rgb.g > 0.99 ||
          rgb.b > 0.99
        ) {
          colors.push(rgb.r, rgb.g, rgb.b)
          addCoordinate(coordinates, rgb)
        }
      }
    }
  }

  let bounds: [number, number, number][] = []
  if (LCH) {
    bounds = [
      [0, 0, 1.85],
      [1, 0, 1.85]
    ]
  } else {
    bounds = [
      [0, 0, 0],
      [0, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 0, 1],
      [1, 0, 1],
      [1, 1, 1]
    ]
  }
  for (let i of bounds) {
    coordinates.push(new Vector3(...i))
    colors.push(i[0], i[0], i[0])
  }

  return [coordinates, colors]
}

function generateMesh(scene: Scene, p3: boolean, rec2020: boolean): void {
  scene.clear()

  let mode: 'rgb' | 'rec2020' | 'p3' = 'rgb'
  if (rec2020) {
    mode = 'rec2020'
  } else if (p3) {
    mode = 'p3'
  }

  let [coordinates, colors] = getModelData(mode)
  let geometry = new BufferGeometry().setFromPoints(coordinates)
  let color = new Float32Array(colors)
  geometry.setAttribute('color', new BufferAttribute(color, 3))
  geometry.center()

  let indexDel = Delaunator.from(coordinates.map(c => [c.x, c.z]))
  let meshIndex = []
  for (let i in indexDel.triangles) {
    meshIndex.push(indexDel.triangles[i])
  }
  geometry.setIndex(meshIndex)
  geometry.computeVertexNormals()

  let material = new MeshBasicMaterial({ vertexColors: true })
  let mesh = new Mesh(geometry, material)
  mesh.translateY(0.3)
  scene.add(mesh)

  let plane = new PlaneGeometry(1, 2)
  let planeColor = []
  for (let i = 0; i < 2; i++) {
    planeColor.push(0, 0, 0)
    planeColor.push(1, 1, 1)
  }
  let planeColor32 = new Float32Array(planeColor)
  plane.setAttribute('color', new BufferAttribute(planeColor32, 3))

  if ('array' in plane.attributes.position) {
    let position = Array.from(plane.attributes.position.array)
    let boundary = LCH ? 0.925 : 0.5
    position[1] = boundary
    position[4] = boundary
    position[7] = -boundary
    position[10] = -boundary
    let position32 = new Float32Array(position)
    plane.setAttribute('position', new BufferAttribute(position32, 3))
  }
  if (!LCH) {
    plane.translate(0, 0, -0.2)
  } else {
    let translate = -0.35
    if (p3) translate = -0.43
    if (rec2020) translate = -0.66
    plane.translate(0, 0, translate)
  }
  let planeMat = new MeshBasicMaterial({
    vertexColors: true,
    side: DoubleSide
  })
  let planeMesh = new Mesh(plane, planeMat)
  planeMesh.rotateX(-Math.PI * 0.5)
  scene.add(planeMesh)
}

function initScene(
  canvas: HTMLCanvasElement,
  fullControl: boolean
): [Scene, Camera, Renderer, OrbitControls] {
  let canvasWidth = canvas.clientWidth
  let canvasHeight = canvas.clientHeight

  let scene = new Scene()
  let camera = new PerspectiveCamera(75, canvasWidth / canvasHeight, 0.1, 1000)
  let renderer = new WebGLRenderer({ canvas, alpha: true })

  renderer.setPixelRatio(window.devicePixelRatio)
  renderer.setSize(canvasWidth, canvasHeight)
  if (LCH) {
    camera.position.set(1.5, 0, 1.5)
  } else {
    camera.position.set(0.79, 0, 0.79)
  }
  camera.lookAt(new Vector3(0, 1, 0))

  let controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = fullControl
  controls.enableZoom = false

  return [scene, camera, renderer, controls]
}

export function initCanvas(
  canvas: HTMLCanvasElement,
  fullControl: boolean = false
): Camera {
  let [scene, camera, renderer, controls] = initScene(canvas, fullControl)
  generateMesh(scene, showP3.get(), showRec2020.get())

  function animate(): void {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  showP3.listen(() => {
    generateMesh(scene, showP3.get(), showRec2020.get())
  })
  showRec2020.listen(() => {
    generateMesh(scene, showP3.get(), showRec2020.get())
  })

  return camera
}
