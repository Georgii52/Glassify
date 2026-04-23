export class CreateGlassesDto {
    name: string;
    position: [number, number, number] = [0, 0, 0];
    rotation: [number, number, number, number] = [0, 0, 0, 0];
    scale: [number, number, number] = [1, 1, 1];
}