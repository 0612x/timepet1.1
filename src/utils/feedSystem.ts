export interface FeedRuntimePetPoints {
  judgeX: number;
  judgeY: number;
}

export interface FeedAssignableDrop {
  id: string;
  x: number;
  y: number;
  createdAt: number;
}

export interface FeedAssignment {
  dropId: string;
  instanceId: string;
  faceRight: boolean;
  distance: number;
}

const DISTANCE_EPSILON = 0.001;

export function measureFeedDistance(points: FeedRuntimePetPoints, drop: Pick<FeedAssignableDrop, 'x' | 'y'>) {
  return {
    distance: Math.hypot(points.judgeX - drop.x, points.judgeY - drop.y),
    faceRight: drop.x >= points.judgeX,
  };
}

export interface FeedAssignablePet {
  instanceId: string;
  points: FeedRuntimePetPoints;
}

export function assignFeedTargets(
  drops: FeedAssignableDrop[],
  pets: FeedAssignablePet[],
) {
  const remainingDrops = [...drops];
  const remainingPets = [...pets];
  const assignments: FeedAssignment[] = [];

  while (remainingDrops.length > 0 && remainingPets.length > 0) {
    let bestCandidate: (FeedAssignment & {petIndex: number; dropIndex: number; createdAt: number}) | null = null;

    remainingDrops.forEach((drop, dropIndex) => {
      remainingPets.forEach((pet, petIndex) => {
        const nearest = measureFeedDistance(pet.points, drop);
        const candidate = {
          dropId: drop.id,
          instanceId: pet.instanceId,
          faceRight: nearest.faceRight,
          distance: nearest.distance,
          petIndex,
          dropIndex,
          createdAt: drop.createdAt,
        };

        if (!bestCandidate) {
          bestCandidate = candidate;
          return;
        }

        const distanceDelta = candidate.distance - bestCandidate.distance;
        if (Math.abs(distanceDelta) > DISTANCE_EPSILON) {
          if (distanceDelta < 0) {
            bestCandidate = candidate;
          }
          return;
        }

        if (candidate.createdAt !== bestCandidate.createdAt) {
          if (candidate.createdAt < bestCandidate.createdAt) {
            bestCandidate = candidate;
          }
          return;
        }

        if (candidate.dropId !== bestCandidate.dropId) {
          if (candidate.dropId < bestCandidate.dropId) {
            bestCandidate = candidate;
          }
          return;
        }

        if (candidate.instanceId < bestCandidate.instanceId) {
          bestCandidate = candidate;
        }
      });
    });

    if (!bestCandidate) break;

    assignments.push({
      dropId: bestCandidate.dropId,
      instanceId: bestCandidate.instanceId,
      faceRight: bestCandidate.faceRight,
      distance: bestCandidate.distance,
    });

    remainingDrops.splice(bestCandidate.dropIndex, 1);
    remainingPets.splice(bestCandidate.petIndex, 1);
  }

  return assignments;
}
