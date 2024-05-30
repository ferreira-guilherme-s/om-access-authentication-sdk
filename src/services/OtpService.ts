import { Repository } from 'typeorm'
import { authenticator } from 'otplib'
import { LoginEntity } from '../entities'
import { AuthenticationModule } from '../module/AuthenticationModule'
import { ErrorCode } from '../helpers/ErrorCode'
import { TupleResult } from '../types'

export type SecretAndKeyUri = {
  secret: string
  keyUri: string
}

export class OtpService {
  private repository: Repository<LoginEntity>

  constructor() {
    this.repository = AuthenticationModule.connection.getRepository(LoginEntity)
  }

  /**
   * Generate the first otp secret token and storage on database
   * @param loginId of login entity
   * @returns Tuple with [{secret: string, keyUri: string}, error code]
   */
  async createOTP(loginId: string): Promise<TupleResult<SecretAndKeyUri, ErrorCode>> {
    const login = await this.repository.findOne({ where: { id: loginId } })
    if (!login) return [null, ErrorCode.LOGIN_NOT_FOUND]

    if (login.otpToken != null) return [null, ErrorCode.LOGIN_ALREADY_HAS_OTP]

    login.otpToken = authenticator.generateSecret()
    await this.repository.save(login)

    const keyUri = authenticator.keyuri(login.email, AuthenticationModule.config.appName, login.otpToken)
    const secretAndKeyUri: SecretAndKeyUri = { secret: login.otpToken, keyUri }

    return [secretAndKeyUri, null]
  }

  /**
   * Update the secret token saved on database
   * @param loginId of login entity
   * @param token generated by application
   * @returns Tuple with [{secret: string, keyUri: string}, error code]
   */
  async updateOTP(loginId: string, token: string): Promise<TupleResult<SecretAndKeyUri, ErrorCode>> {
    const login = await this.repository.findOne({ where: { id: loginId } })
    if (!login) return [null, ErrorCode.LOGIN_NOT_FOUND]

    const tokenIsValid = authenticator.check(token, login.otpToken)
    if (!tokenIsValid) return [null, ErrorCode.TOKEN_OTP_INVALID]

    login.otpToken = authenticator.generateSecret()
    await this.repository.save(login)

    const keyUri = authenticator.keyuri(login.email, AuthenticationModule.config.appName, login.otpToken)
    const secretAndKeyUri: SecretAndKeyUri = { secret: login.otpToken, keyUri }

    return [secretAndKeyUri, null]
  }

  /**
   * Validate if the token generated by application is correct
   * @param loginId of login entity
   * @param token generated by application
   * @returns Tupple with [boolean result, error code]
   */
  async validateOTP(loginId: string, token: string): Promise<TupleResult<boolean, ErrorCode>> {
    const login = await this.repository.findOne({ where: { id: loginId } })
    if (!login) [null, ErrorCode.LOGIN_NOT_FOUND]

    const tokenIsValid = authenticator.check(token, login.otpToken)

    return [tokenIsValid, null]
  }

  /**
   * Remove a secret token stored on database
   * @param loginId of login entity
   * @param token generated by application
   * @returns Tuple with [true, error code]
   */
  async removeOTP(loginId: string, token: string): Promise<TupleResult<true, ErrorCode>> {
    const login = await this.repository.findOne({ where: { id: loginId } })
    if (!login) [null, ErrorCode.LOGIN_NOT_FOUND]

    const tokenIsValid = authenticator.check(token, login.otpToken)
    if (!tokenIsValid) return [null, ErrorCode.TOKEN_OTP_INVALID]

    return [true, null]
  }
}
