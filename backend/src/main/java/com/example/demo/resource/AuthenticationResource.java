package com.example.demo.resource;

import com.example.demo.HttpAuthLoginRequest;
import com.example.demo.HttpAuthRegisterRequest;
import com.example.demo.HttpNewPasswordRequest;
import com.example.demo.HttpPasswordResetRequest;
import com.example.demo.domain.PasswordReset;
import com.example.demo.domain.User;
import com.example.demo.domain.UserPrincipal;
import com.example.demo.email.EmailService;
import com.example.demo.exception.domain.*;
import com.example.demo.service.PasswordResetService;
import com.example.demo.service.UserService;
import com.example.demo.utility.UserMapper;
import jakarta.mail.MessagingException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import javax.validation.constraints.Email;
import javax.validation.constraints.NotNull;

@RestController
public class AuthenticationResource {
    private final UserService userService;
    private final PasswordResetService passwordResetService;
    private final EmailService emailService;

    public AuthenticationResource(UserService userService, PasswordResetService passwordResetService, EmailService emailService) {
        this.userService = userService;
        this.passwordResetService = passwordResetService;
        this.emailService = emailService;
    }

    @RequestMapping(value = "/register", method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.CREATED)
    public User registerNewUser(@Valid @RequestBody HttpAuthRegisterRequest register, BindingResult result) throws Exception {
        if (result.hasErrors()) {
            throw new UserValidationException(result.getAllErrors().get(0).getDefaultMessage());
        }

        // map to user class
        User user = UserMapper.INSTANCE.HttpAuthRegisterRequestToUser(register);

        String rawPassword = user.getPassword();

        user = userService.createUser(user);

        //send email
        emailService.sendNewPasswordEmail(user.getFirstName(), rawPassword, user.getEmail());

        return user;
    }

    @RequestMapping(value = "/login", method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    public ResponseEntity<Void> getTokenForUser(@Valid @RequestBody HttpAuthLoginRequest request, BindingResult result) throws Exception {
        // check if request has errors
        if (result.hasErrors()) {
            throw new UserValidationException(result.getAllErrors().get(0).getDefaultMessage());
        }

        // check if user exists & generate JWT for that user
        userService.validateUser(request.username(), request.password());

        // if error not thrown from validateUser - generate token & return

        String token = userService.generateTokenForUser(request.username());
        if(token == null) throw new Exception("");

        HttpHeaders headers= new HttpHeaders();
        headers.set(HttpHeaders.AUTHORIZATION, String.format("Bearer %s", token));
        return ResponseEntity.ok().headers(headers).build();
    }

    @RequestMapping(value = "/reset", method = RequestMethod.POST)
    @ResponseStatus(HttpStatus.OK)
    public ResponseEntity<Void> resetPassword(@Valid @RequestBody HttpPasswordResetRequest email, BindingResult result) throws EmailNotFoundException, MessagingException {
        if(result.hasErrors()){
            System.out.println(result.getAllErrors());
            throw new EmailNotFoundException("");
        }
        User user = userService.resetPassword(email.email());
        if(user == null) throw new EmailNotFoundException("");
        String link = passwordResetService.generatePasswordResetLink(email.email());
        emailService.sendResetPasswordEmail(user.getFirstName(), link, user.getEmail());
        return ResponseEntity.ok().build();
    }

    @RequestMapping(value = "/reset/{resetLink}", method = RequestMethod.GET)
    @ResponseStatus(HttpStatus.OK)
    public ResponseEntity<Void> newPassword(@Valid @RequestBody HttpNewPasswordRequest request, @PathVariable("resetLink") String resetLink) {
        if(!request.newPassword().equals(request.newPasswordRepeated())) return ResponseEntity.badRequest().build();

        String emailByLink = passwordResetService.getEmailByLink(resetLink);
        if(emailByLink == null) return ResponseEntity.badRequest().build();

        userService.updatePassword(emailByLink, request.newPassword());
        passwordResetService.deleteDBEntryByEmail(emailByLink);
        return ResponseEntity.ok().build();
    }
}
