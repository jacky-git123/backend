import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserHierarchyService } from './user-hierarchy-service.service';
import { SessionAuthGuard } from 'src/session/session-auth.guard';
import { SessionUser } from 'src/session/session.dto';
import { CurrentUser } from 'src/session/current-user.decorator';

@Controller('user')
@UseGuards(SessionAuthGuard) 
export class UserController {
  constructor(private readonly userService: UserService, private readonly userHierarchyService:UserHierarchyService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto, @CurrentUser() user: SessionUser) {
    delete createUserDto.userid;
    return this.userService.createUser(createUserDto);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    // @Query('userid') userid: any,
    @CurrentUser() user: SessionUser
  ) {
    return this.userService.findAll(Number(page), Number(limit), filter, user.id);
  }

  @Get('activeUser')
  async findAllActive(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    // @Query('userid') userid: any,
    @CurrentUser() user: SessionUser
  ) {
    return this.userService.findAllActive(Number(page), Number(limit), filter, user.id);
  }

  @Get('getLeads')
  async findLeads() {
    return this.userService.findAllLeads();
  }

  @Get('getAdminsAndLeads')
  async getAgents() {
    return this.userService.getAdminsAndLeads();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findOne(id);
  }

  @Get('getAgentAndLeads/:key')
  async findAgentAndLeads(@Param('key') key: string) {
    return this.userService.findAgentAndLeads(key);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.userService.remove(id);
  }

  @Get(':userId/hierarchy')
  async getUserHierarchy(
    @Param('userId') userId: string
  ): Promise<any> {
    return this.userHierarchyService.getUserHierarchy(userId);
  }

  @Get(':userId/hierarchy/detailed')
  async getUserHierarchyWithDetails(
    @Param('userId') userId: string
  ): Promise<any & { hierarchyTree: any[] }> {
    return this.userHierarchyService.getUserHierarchyWithDetails(userId);
  }

  @Get('leads-and-agents/:id')
  async getLeadsAndAgents(
    @Param('id') id: string,
  ) {
    return this.userHierarchyService.getLeadsAndAgentsByHierarchy(id);
    
  }

  // Optional: If you want a simpler endpoint without hierarchy filtering
  @Get('all-leads-and-agents')
  async getAllLeadsAndAgents() {
    return this.userHierarchyService.getAllLeadsAndAgents();
  }

  @Post('agents-by-leads')
  async getAgentsByLeads(
    @Body() body: { leadIds: string[] },
    @CurrentUser() user: SessionUser
  ) {
    return this.userHierarchyService.getAgentsByMultipleLeads(body.leadIds, user.id);
  }
}
