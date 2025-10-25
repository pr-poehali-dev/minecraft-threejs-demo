import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls } from '@react-three/drei';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const BLOCK_TYPES = {
  grass: { color: '#5FAD41', name: 'Трава' },
  dirt: { color: '#8B6F47', name: 'Земля' },
  stone: { color: '#808080', name: 'Камень' },
  wood: { color: '#8B4513', name: 'Дерево' },
  leaves: { color: '#228B22', name: 'Листва' },
  planks: { color: '#DEB887', name: 'Доски' },
  bricks: { color: '#B22222', name: 'Кирпичи' },
  glass: { color: '#87CEEB', name: 'Стекло' },
  wool: { color: '#F0F0F0', name: 'Шерсть' },
  flower: { color: '#FF69B4', name: 'Цветок' },
  torch: { color: '#FFD700', name: 'Факел' },
  stairs: { color: '#A0522D', name: 'Лестница' },
};

type BlockType = keyof typeof BLOCK_TYPES;

interface Block {
  x: number;
  y: number;
  z: number;
  type: BlockType;
}

const RENDER_DISTANCE = 8;
const WORLD_SIZE = 32;

function WorldTerrain({ blocks, onBlockRemove, onBlockAdd }: { 
  blocks: Block[], 
  onBlockRemove: (block: Block) => void,
  onBlockAdd: (x: number, y: number, z: number, type: BlockType) => void 
}) {
  const { camera, raycaster } = useThree();
  const [hoveredBlock, setHoveredBlock] = useState<Block | null>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!hoveredBlock) return;

      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const intersects = raycaster.intersectObjects(
        blocks.map(b => b as any).filter(Boolean)
      );

      if (intersects.length > 0) {
        const block = hoveredBlock;
        
        if (event.button === 0) {
          onBlockRemove(block);
        } else if (event.button === 2) {
          const face = intersects[0].face;
          if (face) {
            const normal = face.normal;
            const newX = Math.round(block.x + normal.x);
            const newY = Math.round(block.y + normal.y);
            const newZ = Math.round(block.z + normal.z);
            
            const selectedType = (window as any).selectedBlockType || 'grass';
            onBlockAdd(newX, newY, newZ, selectedType);
          }
        }
      }
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [hoveredBlock, blocks, camera, raycaster, onBlockRemove, onBlockAdd]);

  return (
    <group>
      {blocks.map((block, i) => {
        const blockType = BLOCK_TYPES[block.type];
        const isGlass = block.type === 'glass';
        
        return (
          <mesh
            key={i}
            position={[block.x, block.y, block.z]}
            onPointerOver={() => setHoveredBlock(block)}
            onPointerOut={() => setHoveredBlock(null)}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial 
              color={blockType.color}
              transparent={isGlass}
              opacity={isGlass ? 0.6 : 1}
              roughness={0.8}
              metalness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

function PlayerController({ onMove }: { onMove: (pos: THREE.Vector3) => void }) {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = true; break;
        case 'KeyS': keys.current.backward = true; break;
        case 'KeyA': keys.current.left = true; break;
        case 'KeyD': keys.current.right = true; break;
        case 'Space': keys.current.jump = true; break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': keys.current.forward = false; break;
        case 'KeyS': keys.current.backward = false; break;
        case 'KeyA': keys.current.left = false; break;
        case 'KeyD': keys.current.right = false; break;
        case 'Space': keys.current.jump = false; break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame((_, delta) => {
    const speed = 5;
    direction.current.set(0, 0, 0);

    if (keys.current.forward) direction.current.z = -1;
    if (keys.current.backward) direction.current.z = 1;
    if (keys.current.left) direction.current.x = -1;
    if (keys.current.right) direction.current.x = 1;

    direction.current.normalize();
    direction.current.applyEuler(camera.rotation);
    direction.current.y = 0;

    velocity.current.x = direction.current.x * speed * delta;
    velocity.current.z = direction.current.z * speed * delta;

    if (keys.current.jump && camera.position.y <= 5) {
      velocity.current.y = 0.2;
    }

    velocity.current.y -= 9.8 * delta * 0.1;

    camera.position.add(velocity.current);

    if (camera.position.y < 5) {
      camera.position.y = 5;
      velocity.current.y = 0;
    }

    onMove(camera.position.clone());
  });

  return null;
}

function PlayerHand({ selectedBlock }: { selectedBlock: BlockType }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  useFrame(() => {
    if (meshRef.current) {
      const offset = new THREE.Vector3(0.3, -0.2, -0.5);
      offset.applyQuaternion(camera.quaternion);
      meshRef.current.position.copy(camera.position).add(offset);
      meshRef.current.rotation.copy(camera.rotation);
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[0.15, 0.15, 0.15]} />
      <meshStandardMaterial color={BLOCK_TYPES[selectedBlock].color} />
    </mesh>
  );
}

function generateWorld(): Block[] {
  const noise2D = createNoise2D();
  const blocks: Block[] = [];

  for (let x = -WORLD_SIZE; x < WORLD_SIZE; x++) {
    for (let z = -WORLD_SIZE; z < WORLD_SIZE; z++) {
      const height = Math.floor(noise2D(x * 0.1, z * 0.1) * 4 + 3);

      for (let y = 0; y <= height; y++) {
        let type: BlockType = 'stone';
        
        if (y === height) {
          type = 'grass';
        } else if (y >= height - 2) {
          type = 'dirt';
        }

        blocks.push({ x, y, z, type });
      }

      if (Math.random() > 0.95 && height > 2) {
        blocks.push({ x, y: height + 1, z, type: 'flower' });
      }

      if (Math.random() > 0.98 && height > 2) {
        for (let ty = height + 1; ty < height + 5; ty++) {
          blocks.push({ x, y: ty, z, type: 'wood' });
        }
        for (let lx = -2; lx <= 2; lx++) {
          for (let lz = -2; lz <= 2; lz++) {
            for (let ly = 0; ly < 2; ly++) {
              if (Math.abs(lx) + Math.abs(lz) < 4) {
                blocks.push({ 
                  x: x + lx, 
                  y: height + 4 + ly, 
                  z: z + lz, 
                  type: 'leaves' 
                });
              }
            }
          }
        }
      }
    }
  }

  return blocks;
}

export default function Minecraft() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedBlock, setSelectedBlock] = useState<BlockType>('grass');
  const [playerPos, setPlayerPos] = useState(new THREE.Vector3(0, 5, 0));
  const [health, setHealth] = useState(10);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const world = generateWorld();
    setBlocks(world);
    (window as any).selectedBlockType = 'grass';
  }, []);

  useEffect(() => {
    (window as any).selectedBlockType = selectedBlock;
  }, [selectedBlock]);

  const handleBlockRemove = (block: Block) => {
    setBlocks(prev => prev.filter(b => 
      !(b.x === block.x && b.y === block.y && b.z === block.z)
    ));
  };

  const handleBlockAdd = (x: number, y: number, z: number, type: BlockType) => {
    const exists = blocks.some(b => b.x === x && b.y === y && b.z === z);
    if (!exists) {
      setBlocks(prev => [...prev, { x, y, z, type }]);
    }
  };

  const visibleBlocks = blocks.filter(block => {
    const distance = Math.sqrt(
      Math.pow(block.x - playerPos.x, 2) +
      Math.pow(block.y - playerPos.y, 2) +
      Math.pow(block.z - playerPos.z, 2)
    );
    return distance < RENDER_DISTANCE;
  });

  const blockTypes = Object.keys(BLOCK_TYPES) as BlockType[];

  return (
    <div className="w-full h-screen relative">
      <Canvas camera={{ position: [0, 5, 10], fov: 75 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <WorldTerrain 
          blocks={visibleBlocks}
          onBlockRemove={handleBlockRemove}
          onBlockAdd={handleBlockAdd}
        />
        <PlayerHand selectedBlock={selectedBlock} />
        <PlayerController onMove={setPlayerPos} />
        <PointerLockControls 
          onLock={() => setIsLocked(true)}
          onUnlock={() => setIsLocked(false)}
        />
      </Canvas>

      {!isLocked && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center z-10 bg-black/70 p-8 rounded-lg">
          <h1 className="text-2xl mb-4">Minecraft Demo</h1>
          <p className="text-xs mb-4">Нажмите для начала игры</p>
          <div className="text-[8px] text-left space-y-1">
            <p>WASD - движение</p>
            <p>Пробел - прыжок</p>
            <p>Мышь - взгляд</p>
            <p>ЛКМ - сломать блок</p>
            <p>ПКМ - поставить блок</p>
            <p>1-9 - выбор блока</p>
          </div>
        </div>
      )}

      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white text-[10px] bg-black/50 px-4 py-2 rounded">
        DEMO VERSION
      </div>

      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1">
        {blockTypes.slice(0, 9).map((type, i) => (
          <button
            key={type}
            onClick={() => setSelectedBlock(type)}
            onKeyDown={(e) => {
              if (e.key === String(i + 1)) {
                setSelectedBlock(type);
              }
            }}
            className={`w-12 h-12 border-2 transition-all ${
              selectedBlock === type 
                ? 'border-white scale-110' 
                : 'border-gray-600'
            }`}
            style={{ backgroundColor: BLOCK_TYPES[type].color }}
            title={BLOCK_TYPES[type].name}
          >
            <span className="text-[8px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,1)]">
              {i + 1}
            </span>
          </button>
        ))}
      </div>

      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="w-4 h-4"
            style={{
              backgroundColor: i < health ? '#FF0000' : '#333333',
              border: '1px solid #000',
            }}
          />
        ))}
      </div>
    </div>
  );
}
