import pygame
import random
import sys

pygame.init()

WIDTH = 800
HEIGHT = 600
CELL_SIZE = 20
GRID_WIDTH = WIDTH // CELL_SIZE
GRID_HEIGHT = HEIGHT // CELL_SIZE

BLACK = (0, 0, 0)
GREEN = (0, 255, 0)
RED = (255, 0, 0)
WHITE = (255, 255, 255)

screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Snake Game")
clock = pygame.time.Clock()

class Snake:
    def __init__(self):
        self.body = [(GRID_WIDTH // 2, GRID_HEIGHT // 2)]
        self.direction = (1, 0)
        self.grow = False

    def move(self):
        head = self.body[0]
        new_head = (head[0] + self.direction[0], head[1] + self.direction[1])
        
        if new_head[0] < 0 or new_head[0] >= GRID_WIDTH:
            return False
        if new_head[1] < 0 or new_head[1] >= GRID_HEIGHT:
            return False
        if new_head in self.body:
            return False
        
        self.body.insert(0, new_head)
        if not self.grow:
            self.body.pop()
        else:
            self.grow = False
        return True

    def change_direction(self, direction):
        if (direction[0] * -1, direction[1] * -1) != self.direction:
            self.direction = direction

    def draw(self):
        for segment in self.body:
            pygame.draw.rect(screen, GREEN, (segment[0] * CELL_SIZE, segment[1] * CELL_SIZE, CELL_SIZE, CELL_SIZE))

class Food:
    def __init__(self):
        self.position = self.random_position()

    def random_position(self):
        return (random.randint(0, GRID_WIDTH - 1), random.randint(0, GRID_HEIGHT - 1))

    def draw(self):
        pygame.draw.rect(screen, RED, (self.position[0] * CELL_SIZE, self.position[1] * CELL_SIZE, CELL_SIZE, CELL_SIZE))

def main():
    snake = Snake()
    food = Food()
    score = 0
    font = pygame.font.Font(None, 36)

    while True:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_UP:
                    snake.change_direction((0, -1))
                elif event.key == pygame.K_DOWN:
                    snake.change_direction((0, 1))
                elif event.key == pygame.K_LEFT:
                    snake.change_direction((-1, 0))
                elif event.key == pygame.K_RIGHT:
                    snake.change_direction((1, 0))

        if not snake.move():
            game_over_text = font.render(f"Game Over! Score: {score}", True, WHITE)
            screen.blit(game_over_text, (WIDTH // 2 - 150, HEIGHT // 2))
            pygame.display.flip()
            pygame.time.wait(2000)
            pygame.quit()
            sys.exit()

        if snake.body[0] == food.position:
            snake.grow = True
            score += 1
            food.position = food.random_position()
            while food.position in snake.body:
                food.position = food.random_position()

        screen.fill(BLACK)
        snake.draw()
        food.draw()

        score_text = font.render(f"Score: {score}", True, WHITE)
        screen.blit(score_text, (10, 10))

        pygame.display.flip()
        clock.tick(10)

if __name__ == "__main__":
    main()