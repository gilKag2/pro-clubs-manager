import { inject, injectable } from "tsyringe";
import logger from "../config/logger";
import { BadRequestError } from "../errors";
import { IPlayerRepository } from "../interfaces/player";
import { ITeamRepository } from "../interfaces/team/";
import { IPlayerTeamService } from "../interfaces/wrapper-services/player-team-service.interface";
import { transactionService } from "./transaction-service";

@injectable()
export class PlayerTeamService implements IPlayerTeamService {
  private playerRepository: IPlayerRepository;
  private teamRepository: ITeamRepository;

  constructor(@inject("ITeamRepository") teamService: ITeamRepository, @inject("IPlayerRepository") playerRepository: IPlayerRepository) {
    this.teamRepository = teamService;
    this.playerRepository = playerRepository;
  }

  async addPlayerToTeam(playerId: string, teamId: string): Promise<void> {
    const player = await this.playerRepository.getPlayerById(playerId);

    if (player.team) {
      throw new BadRequestError(`Player is already in team ${player.team}`);
    }

    const team = await this.teamRepository.getTeamById(teamId);

    if (team.players.includes(player._id)) {
      throw new BadRequestError(`Player ${player.id} is already in team ${teamId}`);
    }

    player.team = team._id;
    team.players.push(player._id);

    await transactionService.withTransaction(async (session) => {
      await player.save({ session });
      await team.save({ session });
    });
  }

  async removePlayerFromTeam(playerId: string, teamId: string): Promise<void> {
    const [player, team] = await Promise.all([this.playerRepository.getPlayerById(playerId), this.teamRepository.getTeamById(teamId)]);

    if (player.team !== team._id) {
      throw new BadRequestError(`Player ${player.id} is not in team ${teamId}`);
    }

    await transactionService.withTransaction(async (session) => {
      logger.info(`PlayerTeamService:  removing player ${playerId} from team ${teamId}`);

      // TODO: implement in repositories
      await this.teamRepository.removePlayerFromTeam(player.team, player.id, session);
      await this.playerRepository.setPlayerTeam(player.id, null, session);
      logger.info(`Successfully removed player ${player.id} from team ${team.id}`);
    });
  }

  async deletePlayer(playerId: string) {
    const player = await this.playerRepository.getPlayerById(playerId);
    await transactionService.withTransaction(async (session) => {
      logger.info(`PlayerTeamService: deleting player ${playerId}`);
      if (player.team) {
        await this.teamRepository.removePlayerFromTeam(player.team, player.id, session);
      }
      await this.playerRepository.deletePlayer(player.id, session);
    });
  }
}
