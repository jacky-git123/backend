import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from 'nestjs-prisma';
import { CustomerModule } from './customer/customer.module';
import { CountryModule } from './country/country.module';
import { UserModule } from './user/user.module';
import { CompanyModule } from './company/company.module';
import { AuthModule } from './auth/auth.module';
import { LoanModule } from './loan/loan.module';
import { PaymentModule } from './payment/payment.module';
import { ReportModule } from './report/report.module';
import { ExpensesModule } from './expenses/expenses.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule.forRoot({
      isGlobal: true,
      prismaServiceOptions: {
        prismaOptions:{
          // log: ['query', 'info', 'warn', 'error'],
          datasources: {
            db: {
              url: process.env.DATABASE_URL,
            },
          },
        }
      }
    }),
    CustomerModule,
    CountryModule,
    UserModule,
    CompanyModule,
    AuthModule,
    LoanModule,
    PaymentModule,
    ReportModule,
    ExpensesModule,
    SessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
