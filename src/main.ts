import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as session from 'express-session';
import * as passport from 'passport';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = [
    'http://localhost:4200',
    'https://cs-season.com',
    'https://www.cs-season.com',
    'https://cs-summer.com',
    'https://www.cs-summer.com'
  ];

  // Single CORS configuration
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    credentials: true,
  });

  // Get the custom Prisma session store
  const prismaSessionStore = app.get('PRISMA_SESSION_STORE');

  // Session configuration with custom Prisma store
  app.  use(
    session({
      store: prismaSessionStore,
      secret: process.env.SESSION_SECRET || 'Xr7$Qv9!pL2@dZm8',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        maxAge: 5 * 60 * 1000, // 5 minutes
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      },
      name: 'sessionId',
      // Custom touch function for better performance
      unset: 'destroy',
    }),
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  const config = new DocumentBuilder()
    .setTitle('API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT || 3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
