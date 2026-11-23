import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { Server as ColyseusServer } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ConfigurableCommunicationPolicy, type CommunicationGovernancePolicy } from '@pkg/contracts';
import { AuthService } from './auth/authService.js';
import { bootstrapDatabase, type BootstrapOptions } from './bootstrap.js';
import { createDatabase, type AppDatabase } from './db/client.js';
import { createHttpServer, type HttpOptions } from './http/server.js';
import { LearningService } from './learning/learningService.js';
import { LobbyService } from './lobby/lobbyService.js';
import { RankingService } from './ranking/rankingService.js';
import * as rewards from './rewards/rewardsService.js';
import { MatchCoordinator, type MatchmakingScoreOptions } from './rooms/matchCoordinator.js';
import { MatchRoom } from './rooms/matchRoom.js';

export interface AppServerOptions extends BootstrapOptions, HttpOptions {
  db?:AppDatabase; databaseUrl?:string; timeScale?:number; gameSeed?:number; matchWaitMs?:number; acceptWaitMs?:number;
  reconnectProtectionMs?:number; communicationPolicy?:CommunicationGovernancePolicy;
  matchingWindow?:{initialScoreGap:number;widenPerSecond:number;maxScoreGap:number};matchmakingScore?:MatchmakingScoreOptions;
}
export async function createAppServer(options:AppServerOptions={}) {
  const db=options.db??createDatabase(options.databaseUrl);const ownDb=!options.db;
  await bootstrapDatabase(db,options);
  const communicationPolicy=options.communicationPolicy??new ConfigurableCommunicationPolicy();
  let matches:MatchCoordinator;
  let lobby:LobbyService;
  const auth=new AuthService(db,userId=>matches?.resolveActiveSeat(userId)??null);
  const ranking=new RankingService(db);const learning=new LearningService(db,{pointsPerTask:Number(process.env.REWARD_POINTS_PER_TASK??30)});
  matches=new MatchCoordinator({db,auth,ranking,learning,timeScale:options.timeScale??1,gameSeed:options.gameSeed,
    reconnectProtectionMs:options.reconnectProtectionMs??15_000,communicationPolicy,matchmakingScore:options.matchmakingScore,
    onMatchEnded:(roomId,userIds)=>lobby?.clearMatchForUsers(roomId,userIds)});
  lobby=new LobbyService({createMatch:input=>matches.createMatch(input),
    isMatchAlive:(roomId,userId)=>matches.isMatchAlive(roomId,userId),
    matchWaitMs:options.matchWaitMs,
    acceptWaitMs:options.acceptWaitMs,communicationPolicy,matchingWindow:options.matchingWindow??{initialScoreGap:200,widenPerSecond:50,maxScoreGap:1000},
    scoreCandidate:(profile,mode)=>matches.scoreCandidate(profile,mode)});
  const app=await createHttpServer({db,auth,ranking,rewards,learning,lobby,matches,contentRoot:options.contentRoot},options);
  await app.ready();
  const httpServer=createServer();
  const gameServer=new ColyseusServer({transport:new WebSocketTransport({server:httpServer}),greet:false,gracefullyShutdown:false});
  gameServer.define(matches.roomType,MatchRoom,{runtime:matches.runtime,expectedCapability:matches.capability} as never);
  await gameServer.serverless();
  const colyseusListeners=httpServer.listeners('request');httpServer.removeAllListeners('request');
  httpServer.on('request',(request,response)=> {
    const path=(request.url??'/').split('?')[0]!;
    if(path.startsWith('/matchmake/')||path==='/__healthcheck') {
      for(const listener of colyseusListeners)listener.call(httpServer,request,response);
    } else app.routing(request,response);
  });
  let closed=false;
  return {app,db,auth,ranking,rewards,learning,lobby,matches,gameServer,httpServer,
    async listen(port=0,host='127.0.0.1'):Promise<string> {
      if(!httpServer.listening)await new Promise<void>((resolve,reject)=>{
        const error=(err:Error)=>reject(err);httpServer.once('error',error);
        httpServer.listen(port,host,()=>{httpServer.removeListener('error',error);resolve();});
      });
      const address=httpServer.address();if(!address||typeof address==='string')throw new Error('HTTP_SERVER_ADDRESS_UNAVAILABLE');
      return `http://${host}:${address.port}`;
    },
    async close():Promise<void> {
      if(closed)return;closed=true;lobby.close();
      await gameServer.gracefullyShutdown(false);
      if(httpServer.listening)await new Promise<void>((resolve,reject)=>httpServer.close(error=>error?reject(error):resolve()));
      await app.close();if(ownDb)await db.destroy();
    },
  };
}
export { MatchRoom, MatchCoordinator, LobbyService, AuthService, RankingService, LearningService };

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const server=await createAppServer();
  const port=Number(process.env.PORT??3001);
  const address=await server.listen(port,process.env.HOST??'0.0.0.0');
  console.log(`SparkField server listening at ${address}`);
  const stop=()=>{void server.close().then(()=>process.exit(0),error=>{console.error(error);process.exit(1);});};
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
}
