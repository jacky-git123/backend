import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserHierarchyService } from './user-hierarchy-service.service';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService, private readonly userHierarchyService:UserHierarchyService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    delete createUserDto.userid;
    return this.userService.createUser(createUserDto);
  }

  @Get()
  async findAll(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    @Query('userid') userid: any,
  ) {
    return this.userService.findAll(Number(page), Number(limit), filter, userid);
  }

  @Get('activeUser')
  async findAllActive(
    @Query('page') page: number = 0,
    @Query('limit') limit: number = 10,
    @Query('filter') filter: any,
    @Query('userid') userid: any,
  ) {
    return this.userService.findAllActive(Number(page), Number(limit), filter, userid);
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
}
