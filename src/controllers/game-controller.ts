import { NextFunction, Request, Response } from "express";
import { IGameController, IGameService } from "../interfaces/game";
import { inject, injectable } from "tsyringe";

@injectable()
export default class GameController implements IGameController {
  private gameService: IGameService;

  constructor(@inject("IGameService") gameService: IGameService) {
    this.gameService = gameService;
  }

  async getGameById(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params;

    if (!id) {
      res.status(404).send({ message: "Game not found" });
      return;
    }

    try {
      const game = await this.gameService.getGameById(id);
      res.json(game);
    } catch (error: any) {
      next(error);
    }
  }

  async getTeamGames(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { teamId } = req.params;

    if (!teamId) {
      res.status(400).send({ message: "No teamId provided" });
      return;
    }

    try {
      const games = await this.gameService.getTeamGames(teamId);
      res.json(games);
    } catch (error: any) {
      next(error);
    }
  }

  async updateGameResult(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id } = req.params;
    const { homeTeamGoals, awayTeamGoals } = req.body;

    if (homeTeamGoals === undefined || homeTeamGoals === undefined) {
      res.status(400).send({ message: "Invalid result provided" });
      return;
    }

    try {
      await this.gameService.updateGameResult(id, homeTeamGoals, awayTeamGoals);
      res.sendStatus(200);
    } catch (error: any) {
      next(error);
    }
  }

  async updateTeamPlayersPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: gameId } = req.params;
    const { playersPerformace, isHomeTeam } = req.body;

    if (!gameId || !playersPerformace) {
      res.status(400).send({ message: "missing data" });
      return;
    }

    try {
      await this.gameService.updateTeamPlayersPerformance(gameId, isHomeTeam, playersPerformace);
      res.sendStatus(200);
    } catch (error: any) {
      next(error);
    }
  }

  async deleteGame(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { id: gameId } = req.params;

    if (!gameId) {
      res.status(400).send({ message: "No gameId provided" });
      return;
    }
    try {
      await this.gameService.deleteGame(gameId);
      res.sendStatus(204);
    } catch (error: any) {
      next(error);
    }
  }
}
