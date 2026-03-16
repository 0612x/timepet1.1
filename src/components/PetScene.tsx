import React, { useEffect, useState } from 'react';
import { useStore, CompletedPet } from '../store/useStore';
import { PETS, ThemeType } from '../data/pets';
import { cn } from '../utils/cn';

interface FloatingPet {
  id: string;
  petData: CompletedPet;
  content: (jumpDelay: number, moveDelay: number) => React.ReactNode;
}

interface PetInstanceProps {
  key?: string;
  pet: CompletedPet;
  content: (jd: number, md: number) => React.ReactNode;
  onMove: (id: string, x: number, y: number) => void;
}

function PetInstance({ pet, content, onMove }: PetInstanceProps) {
  const [pos, setPos] = useState({ x: pet.x, y: pet.y });
  const { currentTheme } = useStore();
  
  useEffect(() => {
    const move = () => {
      if (Math.random() > 0.3) {
        const newX = Math.max(5, Math.min(95, pos.x + (Math.random() * 20 - 10)));
        const newY = Math.max(10, Math.min(85, pos.y + (Math.random() * 20 - 10)));
        setPos({ x: newX, y: newY });
        onMove(pet.instanceId, newX, newY);
      }
    };

    const interval = setInterval(move, 4000 + Math.random() * 4000);
    return () => clearInterval(interval);
  }, [pos, pet.instanceId, onMove]);

  const getAnimationClass = (variant: number, theme: ThemeType) => {
    if (theme === 'custom') return 'animate-float'; 
    if (theme === 'B') return 'animate-swim';
    const variants = ['animate-float', 'animate-float-alt', 'animate-pet-move', 'animate-swim'];
    return variants[variant % variants.length];
  };

  return (
    <div
      className={cn("absolute whitespace-nowrap transition-all duration-[4000ms] ease-in-out", getAnimationClass(pet.variant, currentTheme))}
      style={{
        left: `${pos.x}%`,
        top: `${pos.y}%`,
        animationDelay: `${pet.floatDelay}s`,
        animationDuration: `6s`,
        transform: `scale(${pet.scale})`,
      }}
    >
      {content(pet.jumpDelay, pet.moveDelay)}
    </div>
  );
}

export function PetScene({ mini = false }: { mini?: boolean }) {
  const { currentTheme, completedPets, customPets, syncPetData, updatePetPosition } = useStore();
  const [petList, setPetList] = useState<FloatingPet[]>([]);

  useEffect(() => {
    syncPetData();
  }, []);

  useEffect(() => {
    const petsInTheme = completedPets.filter(p => p.theme === currentTheme);
    const newList: FloatingPet[] = [];

    petsInTheme.forEach(completed => {
      let contentFn: FloatingPet['content'];

      if (currentTheme === 'custom') {
        const customPet = customPets.find(p => p.id === completed.petId);
        if (customPet) {
          contentFn = (jumpDelay, moveDelay) => (
            <div className="flex flex-col items-center animate-pet-jump" style={{ animationDelay: `${jumpDelay}s` }}>
              <div className="animate-pet-move" style={{ animationDelay: `${moveDelay}s` }}>
                <img src={customPet.image} alt={customPet.name} className={cn("object-contain drop-shadow-xl", mini ? "w-8 h-8" : "w-12 h-12")} />
              </div>
              {!mini && (
                <span className="text-[10px] font-black mt-1 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full shadow-sm text-indigo-600 border border-indigo-100 uppercase tracking-tighter">
                  {customPet.name}
                </span>
              )}
            </div>
          );
        } else {
          contentFn = () => null;
        }
      } else {
        const petDef = PETS.find(p => p.id === completed.petId);
        if (petDef) {
          let emoji = petDef.base;
          if (completed.state === 'focus') emoji = petDef.focus;
          if (completed.state === 'heal') emoji = petDef.heal;
          if (completed.state === 'active') emoji = petDef.active;
          contentFn = () => <span className={cn("drop-shadow-md", mini ? "text-lg" : "text-2xl")}>{emoji}</span>;
        } else {
          contentFn = () => null;
        }
      }

      newList.push({ id: completed.instanceId, petData: completed, content: contentFn });
    });

    setPetList(newList);
  }, [currentTheme, completedPets, customPets, mini]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {petList.map(item => (
        <PetInstance 
          key={item.id} 
          pet={item.petData} 
          content={item.content} 
          onMove={updatePetPosition} 
        />
      ))}
    </div>
  );
}
