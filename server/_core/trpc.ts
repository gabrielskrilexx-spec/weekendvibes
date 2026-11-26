import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { isAdminUser } from "./admin-auth";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter({ shape }) {
    return {
      ...shape,
      message: String(shape.message).slice(0, 240),
      data: {
        code: String(shape.data?.code ?? "INTERNAL_SERVER_ERROR"),
        httpStatus: Number(shape.data?.httpStatus ?? 500),
        path: shape.data?.path ? String(shape.data.path) : undefined,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const databaseAvailability = t.middleware(async opts => {
  try {
    return await opts.next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/^(database_unavailable|Database unavailable)$/i.test(message.trim())) {
      throw new TRPCError({
        code: "SERVICE_UNAVAILABLE",
        message: "O banco de dados está temporariamente indisponível. Tente novamente.",
        cause: error,
      });
    }
    throw error;
  }
});

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!isAdminUser(ctx.user)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
).use(databaseAvailability);
