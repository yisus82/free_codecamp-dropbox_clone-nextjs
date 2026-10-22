'use client';

import { signInSchema } from '@/schemas';
import { useAuth, useSignIn } from '@clerk/nextjs';
import {
  Button,
  Card,
  ErrorMessage,
  FieldError,
  Form,
  Input,
  InputGroup,
  Label,
  Separator,
  Spinner,
  TextField,
} from '@heroui/react';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Eye, EyeOff, Lock, Mail, MailCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const SignInForm = () => {
  const router = useRouter();
  const { signIn } = useSignIn();
  const { isSignedIn } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    if (!isSignedIn || !signIn) {
      return;
    }

    setIsSubmitting(true);
    setAuthError(null);

    const { error } = await signIn.password({
      emailAddress: data.email,
      password: data.password,
    });

    if (error) {
      console.error('Sign-in error:', JSON.stringify(error, null, 2));
      setAuthError('An error occurred during sign-in. Please try again.');
    } else {
      if (signIn.status === 'complete') {
        await signIn.finalize({
          // Redirect the user to the dashboard page after signing in.
          // You can customize this URL based on your application's routing.
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/dashboard');
            if (url.startsWith('http')) {
              window.location.href = url;
            } else {
              router.push(url);
            }
          },
        });
      } else {
        console.error('Sign-in attempt not complete:', JSON.stringify(error, null, 2));
        setAuthError('Sign-in attempt not complete. Please try again.');
      }
    }
  };

  const handleVerificationSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!isSignedIn || !signIn) {
    }

    setIsSubmitting(true);
    setVerificationError(null);

    const { error } = await signIn.mfa.verifyEmailCode({
      code: verificationCode,
    });

    if (error) {
      console.error('Verification error:', JSON.stringify(error, null, 2));
      setVerificationError('An error occurred during verification. Please try again.');
    } else {
      if (signIn.status === 'complete') {
        setIsVerifying(false);
        await signIn.finalize({
          // Redirect the user to the dashboard page after signing up
          // You can customize this URL based on your application's routing.
          navigate: ({ decorateUrl }) => {
            const url = decorateUrl('/dashboard');
            if (url.startsWith('http')) {
              window.location.href = url;
            } else {
              router.push(url);
            }
          },
        });
      }
    }

    setIsSubmitting(false);
  };

  if (isVerifying || signIn?.status === 'needs_client_trust') {
    return (
      <Card className='w-full max-w-md border border-default-200 bg-default-50 shadow-xl'>
        <Card.Header className='flex flex-col gap-1 items-center pb-2'>
          <Card.Title className='text-2xl font-bold text-default-900'>Verify Your Email</Card.Title>
          <Card.Description className='text-default-500 text-center'>
            We've sent a verification code to your email
          </Card.Description>
        </Card.Header>

        <Separator />

        <Card.Content className='py-6'>
          <ErrorMessage className='bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2'>
            {verificationError && (
              <>
                <AlertCircle className='h-5 w-5 shrink-0' />
                <p>{verificationError}</p>
              </>
            )}
          </ErrorMessage>

          <Form onSubmit={handleVerificationSubmit} className='space-y-6'>
            <TextField className='space-y-2'>
              <Label htmlFor='verificationCode' className='text-sm font-medium text-default-900'>
                Verification Code
              </Label>
              <Input
                id='verificationCode'
                type='text'
                placeholder='Enter the 6-digit code'
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                className='w-full'
                autoFocus
              />
            </TextField>

            <Button type='submit' variant='primary' className='w-full' isPending={isSubmitting}>
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color='current' size='sm' />
                  ) : (
                    <MailCheck className='h-4 w-4 text-default-500' />
                  )}
                  {isPending ? 'Verifying...' : 'Verify Email'}
                </>
              )}
            </Button>
          </Form>

          <div className='mt-6 text-center'>
            <p className='text-sm text-default-500'>Didn't receive a code?</p>
            <Button
              onClick={async () => {
                if (signIn) {
                  await signIn.mfa.sendEmailCode();
                }
              }}
              variant='primary'
              className='hover:underline font-medium'
            >
              Resend code
            </Button>
          </div>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card className='w-full max-w-md border border-default-200 bg-default-50 shadow-xl'>
      <Card.Header className='flex flex-col gap-1 items-center pb-2'>
        <Card.Title className='text-2xl font-bold text-default-900'>Welcome Back</Card.Title>
        <Card.Description className='text-default-500 text-center'>
          Sign in to access your secure cloud storage
        </Card.Description>
      </Card.Header>

      <Separator />

      <Card.Content className='py-6'>
        <ErrorMessage className='bg-danger-50 text-danger-700 p-4 rounded-lg mb-6 flex items-center gap-2'>
          {authError && (
            <>
              <AlertCircle className='h-5 w-5 shrink-0' />
              <p>{authError}</p>
            </>
          )}
        </ErrorMessage>

        <Form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
          <TextField className='space-y-2' isInvalid={!!errors.email}>
            <Label htmlFor='email' className='text-sm font-medium text-default-900'>
              Email
            </Label>
            <InputGroup>
              <InputGroup.Prefix>
                <Mail className='h-4 w-4 text-default-500' />
              </InputGroup.Prefix>
              <InputGroup.Input
                id='email'
                type='email'
                placeholder='your.email@example.com'
                {...register('email')}
                className='w-full'
              />
              <FieldError>{errors.email?.message}</FieldError>
            </InputGroup>
          </TextField>

          <TextField className='space-y-2' isInvalid={!!errors.password}>
            <Label htmlFor='password' className='text-sm font-medium text-default-900'>
              Password
            </Label>
            <InputGroup>
              <InputGroup.Prefix>
                <Lock className='h-4 w-4 text-default-500' />
              </InputGroup.Prefix>
              <InputGroup.Input
                id='password'
                type={showPassword ? 'text' : 'password'}
                placeholder='••••••••'
                {...register('password')}
                className='w-full'
              />
              <InputGroup.Suffix>
                <Button
                  isIconOnly
                  variant='tertiary'
                  size='sm'
                  onClick={() => setShowPassword(!showPassword)}
                  type='button'
                >
                  {showPassword ? (
                    <EyeOff className='h-4 w-4 text-default-500' />
                  ) : (
                    <Eye className='h-4 w-4 text-default-500' />
                  )}
                </Button>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError>{errors.password?.message}</FieldError>
          </TextField>

          <Button type='submit' variant='primary' className='w-full' isPending={isSubmitting}>
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color='current' size='sm' />
                ) : (
                  <UserPlus className='h-4 w-4 text-default-500' />
                )}
                {isPending ? 'Signing in...' : 'Sign In'}
              </>
            )}
          </Button>
        </Form>
      </Card.Content>

      <Separator />

      <Card.Footer className='flex justify-center py-4'>
        <p className='text-sm text-default-600'>
          Don't have an account?{' '}
          <Link href='/sign-up' className='text-primary hover:underline font-medium'>
            Sign up
          </Link>
        </p>
      </Card.Footer>
    </Card>
  );
};

export default SignInForm;
