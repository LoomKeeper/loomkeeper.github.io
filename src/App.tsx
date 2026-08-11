import { StatsigProvider } from '@statsig/react-bindings'
import LandingPage, { LandingFrame } from './LandingPage'

const statsigClientApiKey = import.meta.env.VITE_STATSIG_CLIENT_API_KEY

const App = () => {
  // Without a key there are no gates to read, so let the document's own
  // cautious defaults stand rather than inventing values here.
  if (!statsigClientApiKey) {
    return <LandingFrame flags={null} />
  }

  return (
    <StatsigProvider
      sdkKey={statsigClientApiKey}
      user={{}}
      options={{
        environment: { tier: import.meta.env.DEV ? 'development' : 'production' },
        loggingEnabled: 'disabled',
      }}
    >
      <LandingPage />
    </StatsigProvider>
  )
}

export default App
