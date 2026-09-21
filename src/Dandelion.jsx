import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const TIERS = [
  { y: 0.42, r: 0.90, h: 0.74 },
  { y: 0.86, r: 0.74, h: 0.66 },
  { y: 1.24, r: 0.58, h: 0.60 },
  { y: 1.56, r: 0.40, h: 0.52 },
  { y: 1.82, r: 0.24, h: 0.44 },
]

export default function Dandelion() {
  const mountRef = useRef(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(48, mount.clientWidth / mount.clientHeight, 0.01, 100)
    camera.position.set(0.2, 1.4, 2.6)
    camera.lookAt(0, 1.35, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(0.35)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.domElement.style.imageRendering = 'pixelated'
    renderer.domElement.style.pointerEvents = 'none'
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xc8dff5, 0.95))
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.05)
    sun.position.set(3, 9, 5)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0xa8c8f0, 0.35)
    fill.position.set(-5, 2, -3)
    scene.add(fill)

    const tree = new THREE.Group()
    scene.add(tree)

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.052, 0.082, 0.56, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a1e08 })
    )
    trunk.position.y = 0.28
    tree.add(trunk)

    const darkGreen = new THREE.MeshLambertMaterial({ color: 0x19391c })
    const midGreen  = new THREE.MeshLambertMaterial({ color: 0x224d20 })

    TIERS.forEach((tier, i) => {
      const foliage = new THREE.Mesh(
        new THREE.ConeGeometry(tier.r, tier.h, 8),
        i % 2 === 0 ? darkGreen : midGreen
      )
      foliage.position.y = tier.y + tier.h * 0.5
      tree.add(foliage)
    })

    const clock = new THREE.Clock()
    let animId

    const animate = () => {
      animId = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      tree.rotation.z = Math.sin(t * 0.55) * 0.022 + Math.sin(t * 1.35) * 0.009
      tree.rotation.x = Math.sin(t * 0.75 + 0.5) * 0.010

      renderer.render(scene, camera)
    }

    animate()

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}
