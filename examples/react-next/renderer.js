// React 18's non-streaming server-side rendering function
import { renderToString } from 'react-dom/server'

// Used to safely serialize JavaScript into
// <script> tags, preventing a few types of attack
import devalue from 'devalue'

// The fastify-vite renderer overrides
export default { 
  createRenderFunction,
  createRoute,
  createErrorHandler,
}

function createRoute ({ handler, errorHandler, route }, scope, config) {
  if (route.getServerSideProps) {
    scope.get(`/json${route.path}`, async (req, reply) => {
      reply.send(await route.getServerSideProps({
        req,
        reply,
        server: scope,
      }))
    })
  }
  scope.get(route.path, {
    ...route.getServerSideProps && {
      async preHandler (req, reply) {
        req.serverSideProps = await route.getServerSideProps({
          req,
          reply,
          server: scope,
        })
      }
    },
    handler,
    errorHandler,
    ...route,
  })
}

function createErrorHandler (client, scope, config) {
  return (error, req, reply) => {
    if (config.dev) {
      console.error(error)
    }
    scope.vite.devServer.ssrFixStacktrace(error)
    scope.errorHandler(error, req, reply)
  }
}

function createRenderFunction ({ createApp }) {
  // createApp is exported by client/index.js
  return function (server, req, reply) {
    // Server data that we want to be used for SSR
    // and made available on the client for hydration
    const serverSideProps = req.serverSideProps
    // Creates main React component with all the SSR context it needs
    const app = createApp({ serverSideProps, server, req, reply }, req.url)
    // Perform SSR, i.e., turn app.instance into an HTML fragment
    const element = renderToString(app)
    return {
      // Server-side rendered HTML fragment
      element,
      // The SSR context data is also passed to the template, inlined for hydration
      hydration: `<script>window.hydration = ${
        devalue({ serverSideProps })
      }</script>`,
    }
  }
}
