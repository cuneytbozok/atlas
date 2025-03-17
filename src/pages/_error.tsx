import { NextPageContext } from 'next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface ErrorProps {
  statusCode?: number;
  message?: string;
}

/**
 * Custom error page to handle server-side errors
 */
function Error({ statusCode, message }: ErrorProps) {
  const errorMessage = message || `An error ${
    statusCode ? `${statusCode} ` : ''
  }occurred on the server`;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Something went wrong</CardTitle>
          <CardDescription>
            {statusCode ? `Error ${statusCode}` : 'Application Error'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">{errorMessage}</p>
          <p className="text-sm text-muted-foreground">
            This error has been logged and will be addressed by our team.
          </p>
        </CardContent>
        <CardFooter className="flex gap-4">
          <Button asChild variant="outline">
            <Link href="/">Go Home</Link>
          </Button>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

Error.getInitialProps = async ({ res, err, asPath }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  
  // Log server-side errors
  if (err && typeof window === 'undefined') {
    // Import logger only on server-side to avoid client bundle bloat
    const { logger } = await import('@/lib/logger');
    
    // Log error with path information
    await logger.error(err, {
      type: 'server_error',
      statusCode,
      path: asPath,
    });
  }
  
  return { statusCode };
};

export default Error; 