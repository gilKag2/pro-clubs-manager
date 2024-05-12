import { ClientSession, Types } from "mongoose";
import { autoInjectable } from "tsyringe";
import { PlayerDTO, TeamDTO } from "../../types-changeToNPM/shared-DTOs";
import BadRequestError from "../errors/bad-request-error";
import NotFoundError from "../errors/not-found-error";
import logger from "../logger";
import { PlayerMapper } from "../mappers/player-mapper";
import { TeamMapper } from "../mappers/team-mapper";
import Player, { IPlayer } from "../models/player";
import Team, { ITeam } from "../models/team";
import { ImageService, PlayerService } from "./";
import ITeamService from "../interfaces/team/team-service.interface";

@autoInjectable()
export default class TeamService implements ITeamService {
  private imageService: ImageService;
  private playerService: PlayerService;

  constructor(imageService: ImageService, playerService: PlayerService) {
    this.imageService = imageService;
    this.playerService = playerService;
  }
  getAllTeams(): Promise<TeamDTO[]> {
    throw new Error("Method not implemented.");
  }

  async getTeamPlayers(teamId: string): Promise<PlayerDTO[]> {
    logger.info(`TeamService: getting players for team ${teamId}`);

    const team = await Team.findById(teamId).populate<{ players: IPlayer[] }>("players");

    if (!team) {
      throw new NotFoundError(`Team ${teamId} not found`);
    }

    return await PlayerMapper.mapToDtos(team.players);
  }

  async createTeam(name: string): Promise<TeamDTO> {
    logger.info(`TeamService: Creating team with name ${name} `);
    const team = await Team.create({ name });
    return await TeamMapper.mapToDto(team);
  }

  async setTeamImage(teamId: string, file: Express.Multer.File): Promise<string> {
    logger.info(`TeamService: setting logo image for team with ${teamId}`);

    const team = await Team.findById(teamId);
    if (!team) {
      throw new NotFoundError(`Team with id ${teamId} not found`);
    }

    if (team.imgUrl) {
      // remove current image from cloud
      await this.imageService.deleteImageFromCloudinary(team.imgUrl);
    }
    const imageUrl = await this.imageService.uploadImage(file);

    team.imgUrl = imageUrl;
    await team.save();
    return imageUrl;
  }

  async getTeamById(id: string): Promise<TeamDTO> {
    logger.info(`TeamService: getting team ${id}`);

    const team = await Team.findById(id);
    if (!team) {
      throw new NotFoundError(`Team with id of: ${id} not found`);
    }
    return await TeamMapper.mapToDto(team);
  }

  async deleteTeam(team: ITeam, session: ClientSession): Promise<void> {
    logger.info(`deleting team with id ${team.id}`);

    if (team.imgUrl) {
      await this.imageService.deleteImageFromCloudinary(team.imgUrl);
    }

    if (team.players.length) {
      await this.playerService.removePlayersFromTeam(team.players, session);
    }

    await Team.findByIdAndDelete(team.id, { session });
  }

  async updateTeamGameStats(teamId: Types.ObjectId, goalsScored: number, goalsConceded: number, session: ClientSession): Promise<void> {
    logger.info(`TeamService: Updating stats for team ${teamId}`);

    const team = await Team.findById(teamId, {}, { session });

    if (!team) {
      throw new NotFoundError(`Team with id ${teamId} not found`);
    }

    team.stats.goalsScored += goalsScored;
    team.stats.goalsConceded += goalsConceded;

    if (!goalsConceded) {
      team.stats.cleanSheets += 1;
    }

    if (goalsScored > goalsConceded) {
      team.stats.wins += 1;
    } else if (goalsScored < goalsConceded) {
      team.stats.losses += 1;
    } else {
      team.stats.draws += 1;
    }

    await team.save({ session });
  }

  async revertTeamGameStats(teamId: Types.ObjectId, goalsScored: number, goalsConceded: number, session: ClientSession): Promise<void> {
    logger.info(`TeamService: Reverting stats for team ${teamId}`);
    const team = await Team.findById(teamId, {}, { session });
    if (!team) {
      throw new NotFoundError(`Team with id ${teamId} not found`);
    }

    // Update team stats
    team.stats.goalsScored -= goalsScored;
    team.stats.goalsConceded -= goalsConceded;
    if (!goalsConceded) {
      team.stats.cleanSheets -= 1;
    }
    if (goalsScored > goalsConceded) {
      team.stats.wins -= 1;
    } else if (goalsScored < goalsConceded) {
      team.stats.losses -= 1;
    } else {
      team.stats.draws -= 1;
    }
    await team.save({ session });
  }

  async setTeamCaptain(teamId: string, captainId: string): Promise<void> {
    logger.info(`Team Service: Setting team captain to captain with id ${captainId} for team with id ${teamId}`);

    const team = await Team.findById(teamId);

    if (!team) {
      throw new NotFoundError(`Team with id ${teamId} not found `);
    }

    const captain = await Player.findById(captainId);

    if (!captain) {
      throw new NotFoundError(`Captain with id ${captainId} not found `);
    }

    if (captain.team._id.toString() != team.id) {
      throw new BadRequestError(`Captain with id ${captainId} does not belong to team with id ${team.id}`);
    }

    team.captain = new Types.ObjectId(captainId);
    await team.save();
  }

  async removePlayerFromTeam(teamId: Types.ObjectId, playerId: Types.ObjectId, session: ClientSession) {
    logger.info(`Team Service: Removing player ${playerId} from team ${teamId}`);
    const team = await Team.findById(teamId, {}, { session });
    if (!team) {
      throw new Error(`Team with id ${teamId} not found`);
    }

    const playerIndex = team.players.indexOf(playerId);
    if (playerIndex === -1) {
      throw new NotFoundError(`Player with id ${playerId} not found in team with id ${teamId}`);
    }

    team.players.splice(playerIndex, 1);
    await team.save({ session });
  }
}
